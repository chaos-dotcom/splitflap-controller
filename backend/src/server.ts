import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createClientAsync, Client } from 'soap';
import { createServer } from 'http'; // Import http server
import { Server as SocketIOServer, Socket } from 'socket.io'; // Import socket.io
import * as mqttClient from './mqttClient'; // Import our MQTT client module
// Adjust the path below if your 'src' and 'backend' folders have a different relationship
import { ControlMode, Scene } from '../../src/types'; // Import shared types

// Load environment variables from .env file
dotenv.config();

const app: Express = express();
const httpServer = createServer(app); // Create HTTP server for Socket.IO
const port = process.env.PORT || 3001; // Use port from .env or default to 3001

// Define the structure for departure data (matching frontend)
interface Departure {
  id: string;
  scheduledTime: string;
  destination: string;
  platform?: string;
  status: string;
  estimatedTime?: string;
}

// NRE LDBWS WSDL URL - Use the latest version
const NRE_LDBWS_WSDL_URL = 'https://lite.realtime.nationalrail.co.uk/OpenLDBWS/wsdl.aspx?ver=2021-11-01';

// --- Application State ---
// Use DISPLAY_LENGTH from constants if available, otherwise hardcode or import differently
const DISPLAY_LENGTH = 12; // Assuming default length for now
let currentDisplayText: string = ' '.repeat(DISPLAY_LENGTH);
let currentAppMode: ControlMode = 'text';
let clockInterval: NodeJS.Timeout | null = null;
let stopwatchInterval: NodeJS.Timeout | null = null;
let stopwatchElapsedTime: number = 0;
let stopwatchStartTime: number = 0;
let isStopwatchRunning: boolean = false;
let sequenceTimeout: NodeJS.Timeout | null = null;
let isSequencePlaying: boolean = false;
// --- End Application State ---

// Enable CORS for HTTP and WebSockets
app.use(cors()); // For HTTP requests like NRE API proxy

// Middleware to parse JSON bodies (though not strictly needed for this GET endpoint)
app.use(express.json());

// API endpoint for departures
app.get('/api/departures', async (req: Request, res: Response) => {
    const fromStation = req.query.from as string;
    const toStation = req.query.to as string | undefined; // We'll ignore this for GetDepartureBoard initially
    const numRows = 10; // Number of departures to fetch

    console.log(`Received request for departures: From=${fromStation}, To=${toStation || 'any'}`);

    // --- Validation ---
    if (!fromStation || fromStation.length !== 3) {
        console.error('Invalid or missing "from" station CRS code.');
        return res.status(400).json({ error: "Invalid or missing 'From' station CRS code (must be 3 letters)." });
    }

    const apiToken = process.env.NRE_API_TOKEN;
    if (!apiToken) {
        console.error('NRE_API_TOKEN not found in environment variables.');
        return res.status(500).json({ error: 'Server configuration error: API token missing.' });
    }

    // --- NRE API Call using 'soap' library ---
    try {
        console.log(`Creating SOAP client for WSDL: ${NRE_LDBWS_WSDL_URL}`);
        const client: Client = await createClientAsync(NRE_LDBWS_WSDL_URL);

        // Add the AccessToken SOAP header
        // The namespace 'http://thalesgroup.com/RTTI/2013-11-28/Token/types' is typically associated with 'typ' or similar prefix in examples.
        const soapHeader = {
            'AccessToken': {
                'TokenValue': apiToken
            }
        };
        // Provide the namespace explicitly for the AccessToken element. The prefix ('typ') is arbitrary here but helps clarity.
        client.addSoapHeader(soapHeader, '', 'typ', 'http://thalesgroup.com/RTTI/2013-11-28/Token/types');

        // Prepare arguments for the GetDepartureBoard operation
        const args = {
            numRows: numRows,
            crs: fromStation,
            // Add filterCrs and filterType if toStation is provided
            ...(toStation && { filterCrs: toStation, filterType: 'to' })
        };

        console.log(`Calling GetDepartureBoardAsync for station: ${fromStation} with args:`, args);

        // Call the SOAP method (method name usually matches WSDL operation + 'Async')
        // The library handles the POST request, SOAPAction header, and XML construction/parsing.
        // The result is typically the first element of the returned array.
        const [result, rawResponse, soapHeaderResponse, rawRequest] = await client.GetDepartureBoardAsync(args);

        console.log("Received response from NRE.");
        // --- DEBUGGING: Log the structure of the parsed result ---
        console.log("Parsed Result Object:", JSON.stringify(result, null, 2));
        // --- END DEBUGGING ---
        // console.log("Raw Response Body:", rawResponse); // Uncomment for deep debugging

        // --- Process Response ---
        // The 'soap' library parses the response into a JavaScript object.
        // Navigate the object structure based on the WSDL/XML response.
        const stationBoardResult = result?.GetStationBoardResult;

        if (!stationBoardResult) {
            console.error('Could not find GetStationBoardResult in NRE response structure:', JSON.stringify(result, null, 2));
            // Note: SOAP Faults are typically thrown as errors by the library, caught in the catch block.
            throw new Error('Unexpected response structure from NRE API.');
        }

        // --- DEBUGGING: Log the stationBoardResult part ---
        console.log("Extracted StationBoardResult:", JSON.stringify(stationBoardResult, null, 2));
        // --- END DEBUGGING ---

        // --- Map Data ---
        // Access data directly from the parsed JavaScript object.
        const departures: Departure[] = [];
        const trainServices = stationBoardResult.trainServices?.service; // Corrected path

        if (trainServices) {
            // Ensure trainServices is an array, even if only one service is returned
            const servicesArray = Array.isArray(trainServices) ? trainServices : [trainServices];

            servicesArray.forEach((service: any) => {
                // Access properties directly, assuming 'soap' library parsed correctly
                const destination = service.destination?.location;
                // Destination can sometimes be an array if there are multiple via points, take the first/primary.
                const destinationName = Array.isArray(destination)
                    ? destination[0]?.locationName || 'Unknown'
                    : destination?.locationName || 'Unknown';

                // Determine status: etd can be 'On time', 'Delayed', 'Cancelled', or an estimated time.
                let status = 'Unknown';
                let estimatedTime: string | undefined = undefined;
                if (service.etd === 'On time') {
                    status = 'On time';
                } else if (service.etd === 'Delayed') {
                    status = 'Delayed';
                } else if (service.etd === 'Cancelled') {
                    status = 'Cancelled';
                } else if (service.etd) { // It's an estimated time
                    status = 'On time'; // Or potentially 'Delayed' if etd > std, but API usually handles this
                    estimatedTime = service.etd;
                } else { // No etd, rely on std
                    status = 'On time'; // Assume on time if no other info
                }


                const departure: Departure = {
                    id: service.serviceID, // Unique ID for the service run
                    scheduledTime: service.std || '??:??', // Scheduled time of departure
                    destination: destinationName,
                    platform: service.platform || undefined, // Platform might be missing
                    status: status,
                    estimatedTime: estimatedTime,
                };
                departures.push(departure);
            });
        } else { // If trainServices is null, undefined, or empty array
            console.log(`No train services found for ${fromStation} in the response.`);
            // Check for informational messages from NRCC
            if (stationBoardResult.nrccMessages?.message) {
                 const messages = Array.isArray(stationBoardResult.nrccMessages.message) ? stationBoardResult.nrccMessages.message : [stationBoardResult.nrccMessages.message];
                 messages.forEach((msg: any) => console.log("NRCC Message:", typeof msg === 'string' ? msg : JSON.stringify(msg)));
            }
        }

        console.log(`Successfully fetched and mapped ${departures.length} departures for ${fromStation}.`);
        res.json(departures); // Send the mapped data to the frontend

    } catch (error: any) {
        console.error('Error calling NRE LDBWS:', error);
        let errorMessage = 'Failed to fetch train data.';
        // Check if it's a SOAP Fault returned by the 'soap' library
        if (error.Fault) {
            console.error('SOAP Fault:', error.Fault);
            errorMessage = `NRE API Fault: ${error.Fault.faultstring || error.Fault.reason || 'Unknown SOAP Fault'}`;
        } else if (error.message) {
            // General error (network, WSDL parsing, etc.)
            errorMessage = error.message;
        }
        res.status(500).json({ error: errorMessage });
    }
});

// Basic root route
app.get('/', (req: Request, res: Response) => {
  res.send('Split-Flap Backend Service is running');
});

// --- WebSocket Server Setup ---
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: "*", // Allow all origins for now, restrict in production
        methods: ["GET", "POST"]
    }
});

const updateDisplayAndBroadcast = (newText: string) => {
    const formattedText = newText.padEnd(DISPLAY_LENGTH).substring(0, DISPLAY_LENGTH);
    if (formattedText !== currentDisplayText) {
        console.log(`[State] Updating display: "${formattedText}"`);
        currentDisplayText = formattedText;
        const published = mqttClient.publishToDisplay(currentDisplayText); // Send to physical display via MQTT
        if (published) {
            io.emit('displayUpdate', { text: currentDisplayText }); // Broadcast to all connected web clients ONLY if publish was attempted
        } else {
            // Optionally inform clients that the display might be disconnected
            io.emit('mqttStatus', mqttClient.getDisplayConnectionStatus());
        }
    }
};

// Function to stop all timed modes
const stopAllTimedModes = (options: { resetStopwatch?: boolean } = {}) => {
    if (clockInterval) clearInterval(clockInterval);
    if (stopwatchInterval) clearInterval(stopwatchInterval);
    if (sequenceTimeout) clearTimeout(sequenceTimeout);
    clockInterval = null;
    stopwatchInterval = null;
    sequenceTimeout = null;
    isStopwatchRunning = false;
    isSequencePlaying = false;

    if (options.resetStopwatch) {
        stopwatchElapsedTime = 0;
        stopwatchStartTime = 0;
        // updateDisplayAndBroadcast(formatStopwatchTime(stopwatchElapsedTime)); // Update display only if mode is stopwatch
    }
};

// Helper function - Placeholder (Refine formatting as needed)
function formatStopwatchTime(timeMs: number): string {
    const totalSeconds = Math.floor(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toString().padStart(2, '0');
    // Example: "   MM:SS    "
    return `   ${mm}:${ss}    `.padEnd(DISPLAY_LENGTH).substring(0, DISPLAY_LENGTH);
}


io.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Send current state to newly connected client
    socket.emit('initialState', {
        text: currentDisplayText,
        mode: currentAppMode,
        stopwatch: {
            elapsedTime: stopwatchElapsedTime,
            isRunning: isStopwatchRunning,
        },
        // Add other relevant state like sequence status if needed
    });
    socket.emit('mqttStatus', mqttClient.getDisplayConnectionStatus()); // Send MQTT status

    // --- Handle events from the client ---

    socket.on('getMqttStatus', () => {
        socket.emit('mqttStatus', mqttClient.getDisplayConnectionStatus());
    });

    socket.on('setMode', (mode: ControlMode) => {
        console.log(`[Socket.IO] Received setMode: ${mode} from ${socket.id}`);
        if (currentAppMode !== mode) {
            stopAllTimedModes({ resetStopwatch: false }); // Stop timers, don't reset stopwatch just by switching mode
            currentAppMode = mode;
            // Handle mode-specific initial actions AFTER stopping old mode timers
            if (mode === 'clock') {
                // Start clock logic (implementation needed in next step)
                console.log('[State] Switched to Clock mode. Needs implementation.');
            } else if (mode === 'stopwatch') {
                // Send current stopwatch state immediately
                updateDisplayAndBroadcast(formatStopwatchTime(stopwatchElapsedTime));
            } else if (mode === 'text') {
                // Ensure display shows current text state
                updateDisplayAndBroadcast(currentDisplayText);
            } else if (mode === 'sequence') {
                 // Ensure display shows current text state (or maybe last line of sequence?)
                 updateDisplayAndBroadcast(currentDisplayText);
            }
            // Broadcast mode change to all clients so UI can update if needed
            io.emit('modeUpdate', { mode: currentAppMode });
        }
    });

    socket.on('setText', (data: { text: string }) => {
        console.log(`[Socket.IO] Received setText: "${data.text}" from ${socket.id}`);
        if (currentAppMode === 'text') { // Only allow direct text setting in text mode
            stopAllTimedModes(); // Stop other modes if text is set manually
            updateDisplayAndBroadcast(data.text);
        } else {
            console.warn(`[Socket.IO] setText ignored: Mode is ${currentAppMode}`);
            socket.emit('error', { message: `Cannot set text directly while in ${currentAppMode} mode.` }); // Inform client
        }
    });

    // --- Placeholder Handlers (To be implemented) ---
    socket.on('startClock', () => {
        console.log(`[Socket.IO] Received startClock from ${socket.id}. Needs implementation.`);
        if (currentAppMode !== 'clock') return;
        stopAllTimedModes();
        // TODO: Implement clock logic using setInterval and updateDisplayAndBroadcast
    });

    socket.on('startStopwatch', () => {
        console.log(`[Socket.IO] Received startStopwatch from ${socket.id}. Needs implementation.`);
        if (currentAppMode !== 'stopwatch' || isStopwatchRunning) return;
        stopAllTimedModes();
        isStopwatchRunning = true;
        // TODO: Implement stopwatch logic using setInterval and updateDisplayAndBroadcast
        stopwatchStartTime = Date.now() - stopwatchElapsedTime; // Resume from previous time
        // Start interval...
    });
    socket.on('stopStopwatch', () => {
        console.log(`[Socket.IO] Received stopStopwatch from ${socket.id}. Needs implementation.`);
        if (currentAppMode !== 'stopwatch' || !isStopwatchRunning) return;
        if (stopwatchInterval) clearInterval(stopwatchInterval);
        stopwatchInterval = null;
        isStopwatchRunning = false;
        stopwatchElapsedTime = Date.now() - stopwatchStartTime; // Record elapsed time
        // No display update here, just stops the timer. Display shows paused time.
        io.emit('stopwatchUpdate', { elapsedTime: stopwatchElapsedTime, isRunning: isStopwatchRunning }); // Inform clients
    });
    socket.on('resetStopwatch', () => {
        console.log(`[Socket.IO] Received resetStopwatch from ${socket.id}. Needs implementation.`);
        if (currentAppMode !== 'stopwatch') return;
        stopAllTimedModes({ resetStopwatch: true }); // Stop and reset
        updateDisplayAndBroadcast(formatStopwatchTime(stopwatchElapsedTime)); // Show 00:00
        io.emit('stopwatchUpdate', { elapsedTime: stopwatchElapsedTime, isRunning: isStopwatchRunning }); // Inform clients
    });

    socket.on('playSequence', (data: { scene: Scene }) => {
        console.log(`[Socket.IO] Received playSequence: ${data.scene.name} from ${socket.id}. Needs implementation.`);
        if (currentAppMode !== 'sequence' || isSequencePlaying) return;
        stopAllTimedModes();
        isSequencePlaying = true;
        // TODO: Implement sequence logic using setTimeout chain and updateDisplayAndBroadcast
    });
    socket.on('stopSequence', () => {
        console.log(`[Socket.IO] Received stopSequence from ${socket.id}. Needs implementation.`);
        if (currentAppMode !== 'sequence' || !isSequencePlaying) return;
        stopAllTimedModes(); // This already clears sequenceTimeout and sets isSequencePlaying = false
        // Optionally send a final display update (e.g., back to spaces or last text)
        // updateDisplayAndBroadcast(' '.repeat(DISPLAY_LENGTH));
        io.emit('sequenceStopped'); // Inform clients
    });
    // --- End Placeholder Handlers ---

    socket.on('disconnect', () => {
        console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
});

// --- Start Servers ---
httpServer.listen(port, () => { // Use httpServer for Socket.IO
    console.log(`[Server] HTTP & WebSocket server listening on http://localhost:${port}`);
    mqttClient.connectToDisplayBroker(); // Connect to the display MQTT broker on startup
});
