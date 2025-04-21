import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createClientAsync, Client } from 'soap';
import { createServer } from 'http'; // Import http server
import { Server as SocketIOServer, Socket } from 'socket.io'; // Import socket.io
import * as mqttClient from './mqttClient'; // Import our MQTT client module
// Adjust the path below if your 'src' and 'backend' folders have a different relationship
// Assuming types are now defined ONLY in the frontend's src/types
// If you create a shared types package later, adjust this import
import { ControlMode, Scene, SceneLine } from '../../src/types';

// Load environment variables from .env file
dotenv.config();

// --- Constants ---
const SPLITFLAP_DISPLAY_LENGTH = 12; // Use consistent naming
// Sequence of colors to use as separators (copied from frontend constants)
const SEPARATOR_COLORS: ReadonlyArray<string> = ['r', 'o', 'y', 'g', 'b', 'v', 'p', 't', 'w'];

// --- Formatting Helpers ---

// Clock Formatter (copied and adapted from frontend ClockMode)
const formatClockTime = (date: Date): string => {
    // Use a specific timezone relevant to the display's location or user preference
    // Example: 'Europe/London'. Adjust as needed.
    const options: Intl.DateTimeFormatOptions = {
        weekday: 'short', // e.g., 'Mon'
        hour: '2-digit', // e.g., '05'
        minute: '2-digit', // e.g., '30'
        hour12: true, // Use AM/PM
        timeZone: 'Europe/London', // IMPORTANT: Set your target timezone
    };
    const formatter = new Intl.DateTimeFormat('en-GB', options);
    const parts = formatter.formatToParts(date);

    let weekday = parts.find(p => p.type === 'weekday')?.value.substring(0, 3) || '???';
    let hour = parts.find(p => p.type === 'hour')?.value || '00';
    let minute = parts.find(p => p.type === 'minute')?.value || '00';
    let dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value || '??';

    // Format: 'DDD HHMM  AP' (12 chars total)
    const formatted = `${weekday} ${hour}${minute}  ${dayPeriod}`;

    return formatted.toUpperCase().padEnd(SPLITFLAP_DISPLAY_LENGTH).substring(0, SPLITFLAP_DISPLAY_LENGTH);
};


// Stopwatch Formatter (copied and adapted from frontend StopwatchMode)
const formatStopwatchTime = (timeMs: number): string => {
    const totalSeconds = Math.floor(timeMs / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const seconds = totalSeconds % 60;

    // Get separator colors based on hours and minutes
    const separatorColor1 = SEPARATOR_COLORS[hours % SEPARATOR_COLORS.length];
    const separatorColor2 = SEPARATOR_COLORS[minutes % SEPARATOR_COLORS.length];

    const hh = hours.toString().padStart(2, '0');
    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toString().padStart(2, '0');
    // Format: "  HHcHMcSS  " (12 chars) - 2 spaces left, 2 spaces right for 8 chars
    const formatted = `  ${hh}${separatorColor1}${mm}${separatorColor2}${ss}  `;

    // Ensure exactly DISPLAY_LENGTH
    return formatted.padEnd(SPLITFLAP_DISPLAY_LENGTH).substring(0, SPLITFLAP_DISPLAY_LENGTH);
};


// --- Express App Setup ---
const app: Express = express();
const httpServer = createServer(app);
const port = process.env.PORT || 3001;

// --- Application State ---
// Use SPLITFLAP_DISPLAY_LENGTH from constants if available, otherwise hardcode or import differently
let currentDisplayText: string = ' '.repeat(SPLITFLAP_DISPLAY_LENGTH);
let currentAppMode: ControlMode = 'text';
let clockInterval: NodeJS.Timeout | null = null;
let stopwatchInterval: NodeJS.Timeout | null = null;
let stopwatchElapsedTime: number = 0; // Stored in milliseconds
let stopwatchStartTime: number = 0; // Timestamp when stopwatch was last started/resumed
let isStopwatchRunning: boolean = false;
let sequenceTimeout: NodeJS.Timeout | null = null;
let isSequencePlaying: boolean = false;
let currentSequence: SceneLine[] = []; // Store the lines of the currently playing sequence
let currentSequenceIndex: number = 0;
// --- Train Mode State ---
const POLLING_INTERVAL_MS = 60000; // Poll every 60 seconds
let currentTrainRoute: { fromCRS: string; toCRS?: string } | null = null;
let lastFetchedDepartures: Departure[] = [];
let trainPollingInterval: NodeJS.Timeout | null = null;
// --- End Application State ---

// --- Middleware ---
app.use(cors()); // For HTTP requests like NRE API proxy
app.use(express.json());

// --- NRE API Endpoint (Existing Code) ---
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

// --- Core Logic ---
const updateDisplayAndBroadcast = (newText: string, sourceMode?: ControlMode) => {
    const formattedText = newText.padEnd(SPLITFLAP_DISPLAY_LENGTH).substring(0, SPLITFLAP_DISPLAY_LENGTH);
    // Only update and broadcast if text actually changes AND
    // (it's a manual update (no sourceMode) OR the sourceMode matches the currentAppMode)
    if (formattedText !== currentDisplayText && (!sourceMode || sourceMode === currentAppMode)) {
        console.log(`[State] Updating display: "${formattedText}" (Mode: ${currentAppMode}, Source: ${sourceMode || 'manual'})`);
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
    console.log(`[Timer] Stopping all timed modes... (Reset Stopwatch: ${!!options.resetStopwatch}, Current Mode: ${currentAppMode})`); // Add context
    if (clockInterval) clearInterval(clockInterval);
    if (stopwatchInterval) clearInterval(stopwatchInterval);
    if (sequenceTimeout) clearTimeout(sequenceTimeout);
    clockInterval = null;
    stopwatchInterval = null;
    sequenceTimeout = null;
    isStopwatchRunning = false; // Ensure stopwatch state is updated
    isSequencePlaying = false; // Ensure sequence state is updated

    if (options.resetStopwatch) {
        console.log('[Timer] Resetting stopwatch state.');
        stopwatchElapsedTime = 0;
        stopwatchStartTime = 0;
    }
    // No automatic display update here, the calling function should handle it
};

// --- Clock Mode Logic ---
const startBackendClock = () => {
    stopAllTimedModes(); // Ensure other modes are stopped
    console.log('[Clock] Starting backend clock interval.');
    const update = () => {
        updateDisplayAndBroadcast(formatClockTime(new Date()));
    };
    update(); // Initial update
    clockInterval = setInterval(update, 1000); // Update every second
};

// --- Stopwatch Mode Logic ---
const startBackendStopwatch = () => {
    if (isStopwatchRunning) return; // Already running
    stopAllTimedModes(); // Ensure other modes are stopped
    console.log('[Stopwatch] Starting backend stopwatch interval.');
    isStopwatchRunning = true;
    stopwatchStartTime = Date.now() - stopwatchElapsedTime; // Adjust for resuming
    stopwatchInterval = setInterval(() => {
        stopwatchElapsedTime = Date.now() - stopwatchStartTime;
        updateDisplayAndBroadcast(formatStopwatchTime(stopwatchElapsedTime));
        // Also broadcast the raw state for potential UI updates
        io.emit('stopwatchUpdate', { elapsedTime: stopwatchElapsedTime, isRunning: isStopwatchRunning });
    }, 100); // Update frequently for smooth display (e.g., 100ms)
    // Broadcast initial running state
    io.emit('stopwatchUpdate', { elapsedTime: stopwatchElapsedTime, isRunning: isStopwatchRunning });
};

const stopBackendStopwatch = () => {
    if (!isStopwatchRunning) return; // Already stopped
    console.log('[Stopwatch] Stopping backend stopwatch interval.');
    if (stopwatchInterval) clearInterval(stopwatchInterval);
    stopwatchInterval = null;
    isStopwatchRunning = false;
    stopwatchElapsedTime = Date.now() - stopwatchStartTime; // Capture final elapsed time
    // Display remains showing the stopped time (updated by last interval)
    io.emit('stopwatchUpdate', { elapsedTime: stopwatchElapsedTime, isRunning: isStopwatchRunning }); // Broadcast stopped state
};

const resetBackendStopwatch = () => {
    console.log('[Stopwatch] Resetting backend stopwatch.');
    stopAllTimedModes({ resetStopwatch: true }); // Stops interval, sets isRunning=false, resets time
    updateDisplayAndBroadcast(formatStopwatchTime(0)); // Update display to 00:00
    io.emit('stopwatchUpdate', { elapsedTime: 0, isRunning: false }); // Broadcast reset state
};

// --- Sequence Mode Logic ---
const playNextSequenceLine = () => {
    // This function is intended to be called via setTimeout
    console.log(`[Sequence] playNextSequenceLine called. Index: ${currentSequenceIndex}, isPlaying: ${isSequencePlaying}`);

    if (!isSequencePlaying || currentSequenceIndex >= currentSequence.length) {
        console.log('[Sequence] Playback finished or stopped.');
        stopAllTimedModes(); // Clears timeout and sets isSequencePlaying = false
        io.emit('sequenceStopped'); // Inform clients
        // Optionally clear display or leave last line?
        // updateDisplayAndBroadcast(' '.repeat(DISPLAY_LENGTH));
        return;
    }

    const line = currentSequence[currentSequenceIndex];
    console.log(`[Sequence] Displaying line ${currentSequenceIndex + 1}/${currentSequence.length}: "${line.text}" for ${line.durationMs ?? 1000}ms`);
    updateDisplayAndBroadcast(line.text);

    const duration = line.durationMs ?? 1000; // Use line duration or default
    currentSequenceIndex++; // Move to next line index

    // Schedule the next call
    sequenceTimeout = setTimeout(() => {
        console.log(`[Sequence] setTimeout fired for next line (index ${currentSequenceIndex}) after ${duration}ms`); // Log when timeout fires
        playNextSequenceLine();
    }, duration);
};

const startBackendSequence = (scene: Scene) => {
    // Add log to check state *before* the guard clause
    console.log(`[Sequence] Inside startBackendSequence. isSequencePlaying: ${isSequencePlaying}, lines: ${scene.lines.length}`);
    if (isSequencePlaying || scene.lines.length === 0) { // Explicitly log if aborted
        console.log(`[Sequence] Start aborted. isPlaying: ${isSequencePlaying}, lines: ${scene.lines.length}`);
        return;
    }
    stopAllTimedModes();
    console.log(`[Sequence] Starting sequence: ${scene.name}`);
    isSequencePlaying = true;
    currentSequence = [...scene.lines]; // Make a copy
    currentSequenceIndex = 0;
    // Use setTimeout for the very first line as well to ensure consistency
    sequenceTimeout = setTimeout(playNextSequenceLine, 50); // Start after a tiny delay
};

const stopBackendSequence = () => {
    if (!isSequencePlaying) return;
    console.log('[Sequence] Stopping sequence playback.');
    stopAllTimedModes(); // Clears timeout and sets isSequencePlaying = false
    io.emit('sequenceStopped'); // Inform clients
};


// --- Socket.IO Connection Handling ---
io.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Send current state to newly connected client
    socket.emit('initialState', {
        text: currentDisplayText,
        mode: currentAppMode,
        stopwatch: {
            elapsedTime: stopwatchElapsedTime, // Send current elapsed time
            isRunning: isStopwatchRunning, // Send current running status
        },
        sequence: {
            isPlaying: isSequencePlaying, // Send sequence playing status
            // Optionally send current line index or scene name if needed
        },
        train: { // Send initial train state
            route: currentTrainRoute,
            departures: lastFetchedDepartures,
        }
    });
    socket.emit('mqttStatus', mqttClient.getDisplayConnectionStatus()); // Send MQTT status

    // --- Handle events from the client ---

    socket.on('getMqttStatus', () => {
        socket.emit('mqttStatus', mqttClient.getDisplayConnectionStatus());
    });

    socket.on('setMode', (mode: ControlMode) => {
        console.log(`[Socket.IO] Received setMode: ${mode} from ${socket.id}`);
        if (currentAppMode !== mode) {
            console.log(`[Mode Change] Switching from ${currentAppMode} to ${mode}`);
            // Stop previous timed modes *before* setting the new mode
            // This prevents starting a new mode's logic while the old one might still be stopping
            stopAllTimedModes({ resetStopwatch: false });

            currentAppMode = mode;
            // Handle mode-specific initial actions AFTER stopping old mode timers
            if (mode === 'clock') {
                startBackendClock(); // Start the clock interval
            } else if (mode === 'train') {
                // Send last known departure data when switching TO train mode
                if (currentTrainRoute) { // If a route was previously active, refresh its display
                    fetchAndProcessDepartures(currentTrainRoute); // This will update display and emit trainDataUpdate
                } else { // Otherwise send last known display text or blank
                    updateDisplayAndBroadcast(currentDisplayText); // Send current text (might be from another mode)
                    // Send empty departures if no route was active
                    socket.emit('trainDataUpdate', { departures: lastFetchedDepartures }); // Send last known list (might be empty)
                }
            } else if (mode === 'stopwatch') {
                // Send current stopwatch state immediately
                updateDisplayAndBroadcast(formatStopwatchTime(stopwatchElapsedTime), 'stopwatch'); // Specify source mode
                // Send running state too
                socket.emit('stopwatchUpdate', { elapsedTime: stopwatchElapsedTime, isRunning: isStopwatchRunning });
            } else if (mode === 'text') {
                // Ensure display shows current text state
                updateDisplayAndBroadcast(currentDisplayText); // Manual update source
            } else if (mode === 'sequence') {
                 // Ensure display shows current text state (or maybe last line of sequence?)
                 updateDisplayAndBroadcast(currentDisplayText); // Manual update source
            }
            // Broadcast mode change to all clients so UI can update if needed
            io.emit('modeUpdate', { mode: currentAppMode });
        }
    });

    socket.on('setText', (data: { text: string }) => {
        console.log(`[Socket.IO] Received setText: "${data.text}" from ${socket.id}`);
        // Allow setText from any mode if initiated by user action (like Send button in Train mode)
        // But ensure it stops any automatic backend timers.
        stopAllTimedModes(); // Stop other modes if text is set manually
        updateDisplayAndBroadcast(data.text); // Send text (source is manual/implicit)
        // Note: If mode was 'train', this stops polling. User needs to Refresh/Select Preset again.
        // If mode was 'clock'/'stopwatch'/'sequence', this stops the timers/playback.
        // } else { // Logic simplified: always stop timers and update display on setText
        //     console.warn(`[Socket.IO] setText received but mode is ${currentAppMode}. Allowing, but stopping timers.`);
        //     // Optionally inform client, but maybe not necessary if it's an expected action like 'Send'
        //     // socket.emit('error', { message: `Cannot set text directly while in ${currentAppMode} mode.` });
        // }
    });

    // --- Implement Clock/Stopwatch/Sequence Handlers ---
    // Clock is handled implicitly by setMode('clock') now
    // socket.on('startClock', () => { ... }); // No longer needed

    socket.on('startStopwatch', () => {
        console.log(`[Socket.IO] Received startStopwatch from ${socket.id}.`);
        if (currentAppMode === 'stopwatch') {
            startBackendStopwatch();
        }
    });
    socket.on('stopStopwatch', () => {
        console.log(`[Socket.IO] Received stopStopwatch from ${socket.id}.`);
        if (currentAppMode === 'stopwatch') {
            stopBackendStopwatch();
        }
    });
    socket.on('resetStopwatch', () => {
        console.log(`[Socket.IO] Received resetStopwatch from ${socket.id}.`);
        if (currentAppMode === 'stopwatch') {
            resetBackendStopwatch();
        }
    });

    socket.on('playSequence', (data: { scene: Scene }) => {
        console.log(`[Socket.IO] Received playSequence: ${data.scene.name} from ${socket.id}.`);
        // Add log to check the current mode on the backend when the event arrives
        console.log(`[Socket.IO] Current backend mode is: ${currentAppMode}`);
        if (currentAppMode === 'sequence') {
            startBackendSequence(data.scene);
        }
    });
    socket.on('stopSequence', () => {
        console.log(`[Socket.IO] Received stopSequence from ${socket.id}.`);
        if (currentAppMode === 'sequence') {
            stopBackendSequence();
        }
    });

    socket.on('startTrainUpdates', (data: { fromCRS: string; toCRS?: string }) => {
        console.log(`[Socket.IO] Received startTrainUpdates: ${data.fromCRS} -> ${data.toCRS || 'any'} from ${socket.id}`);
        if (currentAppMode === 'train') {
            // Only start polling if the route is valid
            if (data.fromCRS && data.fromCRS.length === 3) {
                startTrainPolling({ fromCRS: data.fromCRS, toCRS: data.toCRS || undefined });
            } else {
                console.warn('[Socket.IO] Invalid route received for startTrainUpdates.');
                // Optionally send an error back to the client
                // socket.emit('trainDataUpdate', { error: 'Invalid From CRS code provided.' });
            }
        } else {
             console.warn(`[Socket.IO] Received startTrainUpdates but mode is ${currentAppMode}. Ignoring.`);
        }
    });
    // --- End Mode Handlers ---

    socket.on('disconnect', () => {
        console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
});

// --- Start Servers ---
httpServer.listen(port, () => { // Use httpServer for Socket.IO
    console.log(`[Server] HTTP & WebSocket server listening on http://localhost:${port}`);
    mqttClient.connectToDisplayBroker(); // Connect to the display MQTT broker on startup
});
