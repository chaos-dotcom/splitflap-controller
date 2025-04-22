import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createClientAsync, Client } from 'soap';
import { createServer } from 'http'; // Import http server
import { Server as SocketIOServer, Socket } from 'socket.io'; // Import socket.io
import * as mqttClient from './mqttClient'; // Import our MQTT client module
import axios from 'axios'; // Import axios for internal API call
// Adjust the path below if your 'src' and 'backend' folders have a different relationship
// Assuming types are now defined ONLY in the frontend's src/types
// If you create a shared types package later, adjust this import
import { ControlMode, Scene, SceneLine, Departure } from '../../src/types';

// Load environment variables from .env file
dotenv.config();

// --- Home Assistant MQTT Discovery Configuration ---
const HA_DISCOVERY_PREFIX = 'homeassistant'; // Default HA discovery prefix
const HA_DEVICE_ID = 'splitflap_controller'; // Unique ID for the device in HA
const HA_DEVICE_NAME = 'Split-Flap Controller'; // Name for the device in HA
const HA_MODE_SELECTOR_ID = 'splitflap_mode'; // Unique ID for the mode selector entity
const HA_MODE_SELECTOR_NAME = 'Split-Flap Mode';
const HA_AVAILABILITY_TOPIC = `${HA_DEVICE_ID}/status`; // Shared availability topic

// --- Train Mode Entities ---
const HA_TRAIN_FROM_ID = 'splitflap_train_from';
const HA_TRAIN_FROM_NAME = 'Train From CRS';
const HA_TRAIN_TO_ID = 'splitflap_train_to';
const HA_TRAIN_TO_NAME = 'Train To CRS';
const HA_TRAIN_UPDATE_ID = 'splitflap_train_update';
const HA_TRAIN_UPDATE_NAME = 'Train Update';

// --- Stopwatch Mode Entities ---
// Changed from Switch to Button for Start/Stop toggle
const HA_STOPWATCH_START_STOP_ID = 'splitflap_stopwatch_start_stop';
const HA_STOPWATCH_START_STOP_NAME = 'Stopwatch Start/Stop';
const HA_STOPWATCH_RESET_ID = 'splitflap_stopwatch_reset';
const HA_STOPWATCH_RESET_NAME = 'Stopwatch Reset';

// --- Timer Mode Entities ---
const HA_TIMER_DURATION_ID = 'splitflap_timer_duration';
const HA_TIMER_DURATION_NAME = 'Timer Duration';
const HA_TIMER_START_STOP_ID = 'splitflap_timer_start_stop';
const HA_TIMER_START_STOP_NAME = 'Timer Start/Stop';
const HA_TIMER_SET_ID = 'splitflap_timer_set'; // New ID for Set button
const HA_TIMER_SET_NAME = 'Set Timer'; // New Name for Set button

// Define the topics for the mode selector entity using HA standard structure
const haModeConfigTopic = `${HA_DISCOVERY_PREFIX}/select/${HA_MODE_SELECTOR_ID}/config`;
// State and command topics nested under the entity's discovery path
const haModeStateTopic = `${HA_DISCOVERY_PREFIX}/select/${HA_MODE_SELECTOR_ID}/state`;
const haModeCommandTopic = `${HA_DISCOVERY_PREFIX}/select/${HA_MODE_SELECTOR_ID}/set`;

// Define topics for Train From Text entity
const haTrainFromConfigTopic = `${HA_DISCOVERY_PREFIX}/text/${HA_TRAIN_FROM_ID}/config`;
const haTrainFromStateTopic = `${HA_DISCOVERY_PREFIX}/text/${HA_TRAIN_FROM_ID}/state`;
const haTrainFromCommandTopic = `${HA_DISCOVERY_PREFIX}/text/${HA_TRAIN_FROM_ID}/set`;

// Define topics for Train To Text entity
const haTrainToConfigTopic = `${HA_DISCOVERY_PREFIX}/text/${HA_TRAIN_TO_ID}/config`;
const haTrainToStateTopic = `${HA_DISCOVERY_PREFIX}/text/${HA_TRAIN_TO_ID}/state`;
const haTrainToCommandTopic = `${HA_DISCOVERY_PREFIX}/text/${HA_TRAIN_TO_ID}/set`;

// Define topics for Train Update Button entity
const haTrainUpdateConfigTopic = `${HA_DISCOVERY_PREFIX}/button/${HA_TRAIN_UPDATE_ID}/config`;
const haTrainUpdateCommandTopic = `${HA_DISCOVERY_PREFIX}/button/${HA_TRAIN_UPDATE_ID}/press`;

// Define topics for Stopwatch Start/Stop Button entity
const haStopwatchStartStopConfigTopic = `${HA_DISCOVERY_PREFIX}/button/${HA_STOPWATCH_START_STOP_ID}/config`;
const haStopwatchStartStopCommandTopic = `${HA_DISCOVERY_PREFIX}/button/${HA_STOPWATCH_START_STOP_ID}/press`; // Buttons use /press

// Define topics for Stopwatch Reset Button entity
const haStopwatchResetConfigTopic = `${HA_DISCOVERY_PREFIX}/button/${HA_STOPWATCH_RESET_ID}/config`;
const haStopwatchResetCommandTopic = `${HA_DISCOVERY_PREFIX}/button/${HA_STOPWATCH_RESET_ID}/press`;

// Define topics for Timer Duration Number entity
const haTimerDurationConfigTopic = `${HA_DISCOVERY_PREFIX}/number/${HA_TIMER_DURATION_ID}/config`;
const haTimerDurationStateTopic = `${HA_DISCOVERY_PREFIX}/number/${HA_TIMER_DURATION_ID}/state`;
const haTimerDurationCommandTopic = `${HA_DISCOVERY_PREFIX}/number/${HA_TIMER_DURATION_ID}/set`;

// Define topics for Timer Start/Stop Button entity
const haTimerStartStopConfigTopic = `${HA_DISCOVERY_PREFIX}/button/${HA_TIMER_START_STOP_ID}/config`;
const haTimerStartStopCommandTopic = `${HA_DISCOVERY_PREFIX}/button/${HA_TIMER_START_STOP_ID}/press`;

// Define topics for Timer Set Button entity
const haTimerSetConfigTopic = `${HA_DISCOVERY_PREFIX}/button/${HA_TIMER_SET_ID}/config`;
const haTimerSetCommandTopic = `${HA_DISCOVERY_PREFIX}/button/${HA_TIMER_SET_ID}/press`;

// Define the available modes for the HA select entity
const HA_MODES: ControlMode[] = ['text', 'train', 'sequence', 'clock', 'stopwatch', 'timer'];

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

// Timer Formatter (copied and adapted from frontend TimerMode)
const formatTimerTime = (ms: number): string => {
    if (ms < 0) ms = 0; // Ensure time doesn't go negative
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    // Format: "MM:SS" centered with spaces (12 chars total)
    // Example: "   05:30    "
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    const paddingNeeded = SPLITFLAP_DISPLAY_LENGTH - timeStr.length;
    const leftPadding = Math.floor(paddingNeeded / 2);
    const rightPadding = paddingNeeded - leftPadding;
    const formatted = `${' '.repeat(leftPadding)}${timeStr}${' '.repeat(rightPadding)}`;
    return formatted.substring(0, SPLITFLAP_DISPLAY_LENGTH); // Ensure length constraint
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
// --- Timer Mode State ---
let timerInterval: NodeJS.Timeout | null = null;
let timerTargetMs: number = 0; // The duration the timer was set for
let timerRemainingMs: number = 0; // How much time is left
let timerIsRunning: boolean = false;
let haDiscoveryPublished = false; // Flag to track if discovery config has been sent
// --- End Application State ---

// --- Middleware ---
app.use(cors()); // For HTTP requests like NRE API proxy
app.use(express.json());

// --- NRE API Endpoint (Existing Code) ---
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

        // *** CHANGE: Use GetDepBoardWithDetailsAsync ***
        console.log(`Calling GetDepBoardWithDetailsAsync for station: ${fromStation} with args:`, args); // <-- Updated Log Label
        const [result] = await client.GetDepBoardWithDetailsAsync(args);

        console.log("Received response from NRE.");
        // --- DEBUGGING: Log the structure of the parsed result ---
        console.log("Parsed GetDepBoardWithDetails Result Object:", JSON.stringify(result, null, 2)); // <-- Updated Log Label
        // --- END DEBUGGING ---

        // --- Process Response ---
        // Navigate the object structure based on the WSDL/XML response.
        // *** CHANGE: Access result via GetStationBoardResult (structure might be similar or nested differently) ***
        const stationBoardResult = result?.GetStationBoardResult; // Assuming structure is similar, adjust if needed based on debug log

        if (!stationBoardResult) {
            console.error('Could not find GetStationBoardResult in GetDepBoardWithDetails response:', JSON.stringify(result, null, 2)); // <-- Updated Log Label
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
                // destinationETA will be added below
                destinationETA: undefined, // Initialize destinationETA
            }; // <-- Correct closing brace for the initial object definition

               // --- Extract Destination ETA from Details (if available) ---
               // Logic to find ETA either for the specified 'toStation' or the final destination
               const callingPointsList = service.subsequentCallingPoints?.callingPointList?.callingPoint;
               if (callingPointsList) {
                   const callingPoints = Array.isArray(callingPointsList) ? callingPointsList : [callingPointsList];
                   let targetPoint: any = null;

                   if (toStation) {
                       // Find the specific 'toStation' if provided
                       targetPoint = callingPoints.find((cp: any) => cp.crs === toStation);
                       // console.log(`[ETA Debug][API] Searching for specific toStation: ${toStation}. Found: ${!!targetPoint}`);
                   } else if (callingPoints.length > 0) {
                       // Find the *last* calling point if no 'toStation' is specified
                       targetPoint = callingPoints[callingPoints.length - 1];
                       // console.log(`[ETA Debug][API] No toStation specified. Using last calling point: ${targetPoint?.locationName} (${targetPoint?.crs})`);
                   }

                   if (targetPoint) {
                       // console.log(`[ETA Debug][API] Found target point:`, JSON.stringify(targetPoint)); // Optional: Log the found point
                       let arrivalTime: string | undefined = undefined;
                       const et = targetPoint.et; // Estimated time
                       const st = targetPoint.st; // Scheduled time
                       const etIsTime = et && /^\d{2}:\d{2}$/.test(et);
                       const stIsTime = st && /^\d{2}:\d{2}$/.test(st);
                       // console.log(`[ETA Debug][API] Checking et='${et}' (isTime: ${etIsTime}), st='${st}' (isTime: ${stIsTime})`); // Log et and st

                       // Prefer estimated time if it's a valid time format
                       if (etIsTime) {
                           // console.log(`[ETA Debug][API] Using 'et' (${et}) as arrivalTime.`);
                           arrivalTime = et;
                       }
                       // Otherwise, use scheduled time if it's a valid time format
                       else if (stIsTime) {
                            // console.log(`[ETA Debug][API] Using 'st' (${st}) as arrivalTime.`);
                           arrivalTime = st;
                       }
                       // else {
                       //      console.log(`[ETA Debug][API] Neither 'et' nor 'st' is a valid time for target point.`);
                       // }

                       // Assign if we found a valid time
                       if (arrivalTime) {
                           // console.log(`[ETA Debug][API] Assigning destinationETA = ${arrivalTime}`);
                           departure.destinationETA = arrivalTime;
                       }
                       // else {
                       //      console.log(`[ETA Debug][API] No valid arrivalTime found, destinationETA not set.`);
                       // }
                   }
                   // else {
                   //      console.log(`[ETA Debug][API] Target point not found (either specific toStation or last point).`);
                   // }
               }
               // else {
               //      console.log(`[ETA Debug][API] No subsequent calling points found or structure mismatch for service ${service.serviceID}`);
               // }
               // --- End ETA Extraction ---

            departures.push(departure); // Push the potentially modified object
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

       // --- REMOVED: Separate GetServiceDetails calls are no longer needed ---
       // The ETA extraction now happens within the main loop using data from GetDepBoardWithDetailsAsync


       res.json(departures); // Send the potentially updated departures data

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

// --- Refactored Mode Setting Logic ---
const setBackendMode = (newMode: ControlMode, source: 'socket' | 'mqtt') => {
    if (currentAppMode === newMode) {
        console.log(`[Mode Change] Mode is already ${newMode}. Ignoring request from ${source}.`);
        return; // Already in the requested mode
    }

    console.log(`[Mode Change] Request to switch from ${currentAppMode} to ${newMode} (Source: ${source})`);

    // Stop previous timed modes *before* setting the new mode
    stopAllTimedModes({ resetStopwatch: false });

    currentAppMode = newMode;

    // Handle mode-specific initial actions AFTER stopping old mode timers
    if (newMode === 'clock') {
        startBackendClock(); // Start the clock interval
    } else if (newMode === 'train') {
        // Send last known departure data when switching TO train mode
        if (currentTrainRoute) { // If a route was previously active, fetch and update display
            fetchAndProcessDepartures(currentTrainRoute); // This will update display and emit trainDataUpdate
        } else { // Otherwise send last known display text or blank
            updateDisplayAndBroadcast(currentDisplayText); // Send current text (might be from another mode)
            // Send empty departures if no route was active
            io.emit('trainDataUpdate', { departures: lastFetchedDepartures }); // Send last known list (might be empty)
        }
    } else if (newMode === 'stopwatch') {
        // Send current stopwatch state immediately
        updateDisplayAndBroadcast(formatStopwatchTime(stopwatchElapsedTime), 'stopwatch'); // Specify source mode
        // Send running state too
        io.emit('stopwatchUpdate', { elapsedTime: stopwatchElapsedTime, isRunning: isStopwatchRunning });
    } else if (newMode === 'text') {
        // Ensure display shows current text state
        updateDisplayAndBroadcast(currentDisplayText); // Manual update source
    } else if (newMode === 'sequence') {
         // Ensure display shows current text state (or maybe last line of sequence?)
         updateDisplayAndBroadcast(currentDisplayText); // Manual update source
    } else if (newMode === 'timer') {
        // Send current timer state immediately
        updateDisplayAndBroadcast(formatTimerTime(timerRemainingMs), 'timer');
        // Send running state too
        io.emit('timerUpdate', {
            targetMs: timerTargetMs,
            remainingMs: timerRemainingMs,
            isRunning: timerIsRunning
        });
    }

    // --- Publish state update to HA (using the updated haModeStateTopic variable) ---
    mqttClient.publish(haModeStateTopic, currentAppMode, { retain: true });

    // --- Broadcast mode change to Socket.IO clients ---
    console.log(`[Socket.IO] Emitting modeUpdate event to all clients: ${currentAppMode}`); // <-- ADD LOG
    io.emit('modeUpdate', { mode: currentAppMode });

    console.log(`[Mode Change] Successfully switched to ${currentAppMode}.`);
};
// --- End Refactored Mode Setting Logic ---


// Function to stop all timed modes
const stopAllTimedModes = (options: { resetStopwatch?: boolean } = {}) => {
    console.log(`[Mode Logic] Stopping all timed modes... (Reset SW: ${!!options.resetStopwatch}, Current Mode: ${currentAppMode})`); // Changed log context
    if (clockInterval) clearInterval(clockInterval);
    if (stopwatchInterval) clearInterval(stopwatchInterval);
    if (sequenceTimeout) clearTimeout(sequenceTimeout);
    clockInterval = null;
    stopwatchInterval = null;
    sequenceTimeout = null;
    isStopwatchRunning = false; // Ensure stopwatch state is updated
    if (timerInterval) clearInterval(timerInterval); // Stop timer interval
    timerInterval = null;
    timerIsRunning = false; // Ensure timer state is updated
    stopTrainPolling(); // Stop train polling as well
    isSequencePlaying = false; // Ensure sequence state is updated

    if (options.resetStopwatch) {
        console.log('[Mode Logic] Resetting stopwatch state.'); // Changed log context
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
    console.log('[Stopwatch] startBackendStopwatch called.'); // <-- ADD LOG
    if (isStopwatchRunning) {
        console.log('[Stopwatch] Start ignored: Already running.');
        return;
    }
    stopAllTimedModes(); // Ensure other modes are stopped
    console.log('[Stopwatch] Starting backend stopwatch interval.');
    isStopwatchRunning = true;
    stopwatchStartTime = Date.now() - stopwatchElapsedTime; // Adjust for resuming
    stopwatchInterval = setInterval(() => {
        stopwatchElapsedTime = Date.now() - stopwatchStartTime;
        updateDisplayAndBroadcast(formatStopwatchTime(stopwatchElapsedTime), 'stopwatch'); // Ensure sourceMode is passed
        // Also broadcast the raw state for potential UI updates
        console.log('[Socket.IO] Emitting stopwatchUpdate (interval)'); // <-- ADD LOG
        io.emit('stopwatchUpdate', { elapsedTime: stopwatchElapsedTime, isRunning: isStopwatchRunning });
    }, 100); // Update frequently for smooth display (e.g., 100ms)
    // Broadcast initial running state
    console.log('[Socket.IO] Emitting stopwatchUpdate (start)'); // <-- ADD LOG
    io.emit('stopwatchUpdate', { elapsedTime: stopwatchElapsedTime, isRunning: isStopwatchRunning });
    // No state to publish for button
};

const stopBackendStopwatch = () => {
    console.log('[Stopwatch] stopBackendStopwatch called.'); // <-- ADD LOG
    if (!isStopwatchRunning) {
        console.log('[Stopwatch] Stop ignored: Already stopped.');
        return;
    }
    console.log('[Stopwatch] Stopping backend stopwatch interval.');
    if (stopwatchInterval) clearInterval(stopwatchInterval);
    stopwatchInterval = null;
    isStopwatchRunning = false;
    // Capture final elapsed time only if stopwatchStartTime is valid (was running)
    if (stopwatchStartTime > 0) {
        stopwatchElapsedTime = Date.now() - stopwatchStartTime;
    }
    // Display remains showing the stopped time (updated by last interval)
    console.log('[Socket.IO] Emitting stopwatchUpdate (stop)'); // <-- ADD LOG
    io.emit('stopwatchUpdate', { elapsedTime: stopwatchElapsedTime, isRunning: isStopwatchRunning }); // Broadcast stopped state
    // No state to publish for button
};

const resetBackendStopwatch = () => {
    console.log('[Stopwatch] resetBackendStopwatch called.'); // <-- ADD LOG
    stopAllTimedModes({ resetStopwatch: true }); // Stops interval, sets isRunning=false, resets time
    updateDisplayAndBroadcast(formatStopwatchTime(0), 'stopwatch'); // Update display to 00:00, specify source
    console.log('[Socket.IO] Emitting stopwatchUpdate (reset)'); // <-- ADD LOG
    io.emit('stopwatchUpdate', { elapsedTime: 0, isRunning: false }); // Broadcast reset state
    // No state to publish for button
};

// --- Timer Mode Logic ---
const setBackendTimer = (durationMs: number) => {
    console.log(`[Timer] Setting timer duration: ${durationMs}ms`);
    stopAllTimedModes(); // Stop everything else, including any existing timer

    timerTargetMs = durationMs > 0 ? durationMs : 0; // Ensure non-negative
    timerRemainingMs = timerTargetMs;
    timerIsRunning = false; // Timer is set, but not running yet

    // Update display to show the set time
    updateDisplayAndBroadcast(formatTimerTime(timerRemainingMs), 'timer');

    // Broadcast the new timer state to all clients
    io.emit('timerUpdate', {
        targetMs: timerTargetMs,
        remainingMs: timerRemainingMs,
        isRunning: timerIsRunning
    });
    publishTimerState(); // Publish state to HA
};

const startBackendTimer = () => {
    if (timerIsRunning || timerRemainingMs <= 0) {
        console.log(`[Timer] Start ignored. Running: ${timerIsRunning}, Remaining: ${timerRemainingMs}`);
        return; // Already running or nothing to run
    }
    stopAllTimedModes(); // Ensure other modes are stopped
    console.log('[Timer] Starting backend timer countdown.');
    timerIsRunning = true;
    const startTime = Date.now();
    const expectedEndTime = startTime + timerRemainingMs;

    // Broadcast initial running state
    io.emit('timerUpdate', {
        targetMs: timerTargetMs,
        remainingMs: timerRemainingMs,
        isRunning: timerIsRunning
    });

    timerInterval = setInterval(() => {
        const now = Date.now();
        const newRemainingMs = expectedEndTime - now;
        timerRemainingMs = newRemainingMs > 0 ? newRemainingMs : 0; // Clamp at 0

        // Update display
        updateDisplayAndBroadcast(formatTimerTime(timerRemainingMs), 'timer');

        // Broadcast current state
        io.emit('timerUpdate', {
            targetMs: timerTargetMs,
            remainingMs: timerRemainingMs,
            isRunning: timerIsRunning
        });

        if (timerRemainingMs <= 0) {
            console.log('[Timer] Countdown finished.');
            stopBackendTimer(); // Stop the interval and update state
            // Optionally: Play a sound or flash display? (Future enhancement)
        }
    }, 250); // Update display ~4 times per second
};

const stopBackendTimer = () => {
    if (!timerIsRunning && !timerInterval) { // Check interval too in case it finished itself
        console.log('[Timer] Stop ignored. Not running.');
        return; // Already stopped
    }
    console.log('[Timer] Stopping backend timer.');
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    timerIsRunning = false;
    // Remaining time is already updated by the interval, or stays where it was stopped

    // Broadcast the stopped state
    io.emit('timerUpdate', {
        targetMs: timerTargetMs,
        remainingMs: timerRemainingMs,
        isRunning: timerIsRunning
    });
    // No need to publish state here as setBackendTimer already does
};


// --- Train Mode Logic ---

// Helper to get hour and minute from a departure time string (HH:MM)
const getHourMinute = (timeString: string | undefined): { hour: number | null, minute: number | null } => {
    if (!timeString || !/^\d{2}:\d{2}$/.test(timeString)) {
        return { hour: null, minute: null };
    }
    const parts = timeString.split(':');
    return { hour: parseInt(parts[0], 10), minute: parseInt(parts[1], 10) };
};

// Function to calculate the condensed display string for a single departure (Not used for polling display, but useful elsewhere)
const formatSingleDepartureForDisplay = (dep: Departure, prevDep: Departure | null): string => {
    const displayTimeStr = (dep.estimatedTime && dep.estimatedTime !== 'On time' && dep.estimatedTime !== 'Delayed' && dep.estimatedTime !== 'Cancelled')
        ? dep.estimatedTime : dep.scheduledTime;
    const { hour: currentHour, minute: currentMinute } = getHourMinute(displayTimeStr);

    const prevDisplayTimeStr = prevDep ? ((prevDep.estimatedTime && prevDep.estimatedTime !== 'On time' && prevDep.estimatedTime !== 'Delayed' && prevDep.estimatedTime !== 'Cancelled') ? prevDep.estimatedTime : prevDep.scheduledTime) : null;
    const { hour: previousHour } = prevDisplayTimeStr ? getHourMinute(prevDisplayTimeStr) : { hour: null };
    const prevWasSpecialStatus = prevDep && (prevDep.status.toUpperCase() === 'CANCELLED' || (prevDep.status.toUpperCase() === 'DELAYED' && !prevDep.estimatedTime));

    let timePart: string;
    if (dep.status.toUpperCase() === 'CANCELLED') timePart = 'CANC';
    else if (dep.status.toUpperCase() === 'DELAYED' && !dep.estimatedTime) timePart = 'DLAY';
    else if (currentHour !== null && currentMinute !== null) {
        const minuteStr = currentMinute.toString().padStart(2, '0');
        if (currentHour === previousHour && !prevWasSpecialStatus) timePart = `  ${minuteStr}`;
        else timePart = currentHour.toString().padStart(2, '0') + minuteStr;
    } else timePart = '----';

    let output: string;
    if (timePart === 'CANC') output = 'CANCELLED   ';
    else if (timePart === 'DLAY') output = 'DELAYED     ';
    else {
        const plat = dep.platform ? dep.platform.slice(-1) : ' ';
        const maxDestLength = 7;
        let dest = dep.destination.toUpperCase().substring(0, maxDestLength - plat.length);
        dest = dest.padEnd(maxDestLength - plat.length);
        output = `${timePart} ${dest}${plat}`;
    }
    return output.padEnd(SPLITFLAP_DISPLAY_LENGTH).substring(0, SPLITFLAP_DISPLAY_LENGTH);
};

const fetchAndProcessDepartures = async (route: { fromCRS: string; toCRS?: string }) => {
    if (!route || !route.fromCRS) {
        console.warn('[Train Polling] Attempted fetch without a valid route.');
        return;
    }
    console.log(`[Train Polling] Fetching for route: ${route.fromCRS} -> ${route.toCRS || 'any'}`);
    let concatenatedTimes = ""; // Declare outside the try block
    try {
        // --- Refactor: Call NRE logic directly instead of internal HTTP call ---
        console.log(`[Train Polling] Calling NRE logic for ${route.fromCRS} -> ${route.toCRS || 'any'}`);

        const apiToken = process.env.NRE_API_TOKEN;
        if (!apiToken) throw new Error('NRE_API_TOKEN not configured.');

        const client: Client = await createClientAsync(NRE_LDBWS_WSDL_URL);
        const soapHeader = { 'AccessToken': { 'TokenValue': apiToken } };
        client.addSoapHeader(soapHeader, '', 'typ', 'http://thalesgroup.com/RTTI/2013-11-28/Token/types');

        const args = {
            numRows: 10, // Keep consistent number of rows
            crs: route.fromCRS,
           ...(route.toCRS && { filterCrs: route.toCRS, filterType: 'to' })
       };

       // *** CHANGE: Use GetDepBoardWithDetailsAsync ***
       console.log(`[Train Polling] Calling GetDepBoardWithDetailsAsync with args:`, args); // <-- Updated Log Label
       const [result] = await client.GetDepBoardWithDetailsAsync(args);
       console.log("[Train Polling] Parsed GetDepBoardWithDetails Result:", JSON.stringify(result, null, 2)); // <-- ADD DEBUG LOG

       const stationBoardResult = result?.GetStationBoardResult;
       if (!stationBoardResult) throw new Error('Unexpected response structure from GetDepBoardWithDetails.'); // <-- Updated Error Message

       const fetchedDepartures: Departure[] = [];
        const trainServices = stationBoardResult.trainServices?.service;
        if (trainServices) {
            const servicesArray = Array.isArray(trainServices) ? trainServices : [trainServices];
            servicesArray.forEach((service: any) => {
                const destination = service.destination?.location;
                const destinationName = Array.isArray(destination) ? destination[0]?.locationName || 'Unknown' : destination?.locationName || 'Unknown';
                let status = 'Unknown';
                let estimatedTime: string | undefined = undefined;
                if (service.etd === 'On time') status = 'On time';
                else if (service.etd === 'Delayed') status = 'Delayed';
                else if (service.etd === 'Cancelled') status = 'Cancelled';
                else if (service.etd) { status = 'On time'; estimatedTime = service.etd; }
               else status = 'On time';

               // Create the initial departure object
               const departure: Departure = {
                   id: service.serviceID,
                   scheduledTime: service.std || '??:??',
                   destination: destinationName,
                   platform: service.platform || undefined,
                   status: status,
                   estimatedTime: estimatedTime,
                   // destinationETA will be added below if found
                   destinationETA: undefined, // Initialize destinationETA
               };

               // --- Extract Destination ETA from Details (if available) ---
               // Logic to find ETA either for the specified 'toCRS' or the final destination
               const callingPointsList = service.subsequentCallingPoints?.callingPointList?.callingPoint;
               if (callingPointsList) {
                   const callingPoints = Array.isArray(callingPointsList) ? callingPointsList : [callingPointsList];
                   let targetPoint: any = null;

                   if (route.toCRS) {
                       // Find the specific 'toCRS' if provided
                       targetPoint = callingPoints.find((cp: any) => cp.crs === route.toCRS);
                       // console.log(`[ETA Debug][Poll] Searching for specific toCRS: ${route.toCRS}. Found: ${!!targetPoint}`);
                   } else if (callingPoints.length > 0) {
                       // Find the *last* calling point if no 'toCRS' is specified
                       targetPoint = callingPoints[callingPoints.length - 1];
                       // console.log(`[ETA Debug][Poll] No toCRS specified. Using last calling point: ${targetPoint?.locationName} (${targetPoint?.crs})`);
                   }

                   if (targetPoint) {
                       // console.log(`[ETA Debug][Poll] Found target point:`, JSON.stringify(targetPoint)); // Optional: Log the found point
                       let arrivalTime: string | undefined = undefined;
                       const et = targetPoint.et; // Estimated time
                       const st = targetPoint.st; // Scheduled time
                       const etIsTime = et && /^\d{2}:\d{2}$/.test(et);
                       const stIsTime = st && /^\d{2}:\d{2}$/.test(st);
                       // console.log(`[ETA Debug][Poll] Checking et='${et}' (isTime: ${etIsTime}), st='${st}' (isTime: ${stIsTime})`); // Log et and st

                       // Prefer estimated time if it's a valid time format
                       if (etIsTime) {
                           // console.log(`[ETA Debug][Poll] Using 'et' (${et}) as arrivalTime.`);
                           arrivalTime = et;
                       }
                       // Otherwise, use scheduled time if it's a valid time format
                       else if (stIsTime) {
                            // console.log(`[ETA Debug][Poll] Using 'st' (${st}) as arrivalTime.`);
                           arrivalTime = st;
                       }
                       // else {
                       //      console.log(`[ETA Debug][Poll] Neither 'et' nor 'st' is a valid time for target point.`);
                       // }

                       // Assign if we found a valid time
                       if (arrivalTime) {
                           // console.log(`[ETA Debug][Poll] Assigning destinationETA = ${arrivalTime}`);
                           departure.destinationETA = arrivalTime;
                       }
                       // else {
                       //      console.log(`[ETA Debug][Poll] No valid arrivalTime found, destinationETA not set.`);
                       // }
                   }
                   // else {
                   //      console.log(`[ETA Debug][Poll] Target point not found (either specific toCRS or last point).`);
                   // }
               }
               // else {
               //      console.log(`[ETA Debug][Poll] No subsequent calling points found or structure mismatch for service ${service.serviceID}`);
               // }
               // --- End ETA Extraction ---

               fetchedDepartures.push(departure); // Push the potentially modified object
           });
       }

       // --- REMOVED: Separate GetServiceDetails calls are no longer needed ---


       lastFetchedDepartures = fetchedDepartures; // Update the stored departures
        console.log(`[Train Polling] Processed ${lastFetchedDepartures.length} departures.`);

        // --- Calculate Concatenated Time String FOR AUTOMATIC DISPLAY --- (Keep existing logic)
        // This string will contain HHMM or MM blocks concatenated, no spaces in between.
        concatenatedTimes = ""; // Ensure it's reset for each fetch
        let previousHour: number | null = null; // Track the hour of the previously added time block
        for (const dep of lastFetchedDepartures) {
            const displayTimeStr = (dep.estimatedTime && dep.estimatedTime !== 'On time' && dep.estimatedTime !== 'Delayed' && dep.estimatedTime !== 'Cancelled')
                ? dep.estimatedTime : dep.scheduledTime;
            const { hour: currentHour, minute: currentMinute } = getHourMinute(displayTimeStr);
            const isSpecialStatus = dep.status.toUpperCase() === 'CANCELLED' || (dep.status.toUpperCase() === 'DELAYED' && !dep.estimatedTime);

            // Skip special status trains for this dense view
            if (isSpecialStatus || currentHour === null || currentMinute === null) {
                previousHour = null; // Reset hour context if skipping
                continue; // Go to the next departure
            }

            let timePart: string;
            if (currentHour === previousHour) {
                const minuteStr = currentMinute.toString().padStart(2, '0');
                timePart = minuteStr; // Just "MM" (2 chars)
            } else {
                timePart = `${currentHour.toString().padStart(2, '0')}${currentMinute.toString().padStart(2, '0')}`; // "HHMM" (4 chars)
                previousHour = currentHour; // Update the last seen hour only when HH is shown
            }

            // Only append the 2-char (MM) or 4-char (HHMM) timePart to the string
            if ((concatenatedTimes + timePart).length <= SPLITFLAP_DISPLAY_LENGTH) {
                concatenatedTimes += timePart;
            } else {
                break; // Stop adding times if it exceeds display length
            }
        }
       // --- End Calculation ---

       const finalPaddedString = concatenatedTimes.padEnd(SPLITFLAP_DISPLAY_LENGTH);
       console.log(`[Train Polling] Calculated times string: "${concatenatedTimes}", Padded: "${finalPaddedString}"`); // Log before/after padding

       // Update display with the concatenated string, padded if necessary
       if (concatenatedTimes) {
           updateDisplayAndBroadcast(finalPaddedString, 'train');
       } else {
           updateDisplayAndBroadcast(`${route.fromCRS} NO DEPT`.padEnd(SPLITFLAP_DISPLAY_LENGTH).substring(0, SPLITFLAP_DISPLAY_LENGTH), 'train'); // Show no departures message
       }

        // Send full data to clients interested in the table view
        io.emit('trainDataUpdate', { departures: lastFetchedDepartures });
    } catch (error: any) {
        console.error(`[Train Polling] Error fetching departures for ${route.fromCRS}:`, error.message);
        updateDisplayAndBroadcast(`${route.fromCRS} ERROR`.padEnd(SPLITFLAP_DISPLAY_LENGTH).substring(0, SPLITFLAP_DISPLAY_LENGTH), 'train'); // Show error on display
        io.emit('trainDataUpdate', { error: error.message }); // Send error to clients
    }
};

const startTrainPolling = (route: { fromCRS: string; toCRS?: string }) => {
    stopTrainPolling(); // Stop any previous polling first
    console.log(`[Train Polling] Starting polling for route: ${route.fromCRS} -> ${route.toCRS || 'any'}`);
    currentTrainRoute = route;
    fetchAndProcessDepartures(route); // Fetch immediately
    trainPollingInterval = setInterval(() => {
        // Ensure we only poll if still in train mode and route is set
        console.log(`[Train Polling Interval] Checking conditions. Current Mode: ${currentAppMode}, Route Set: ${!!currentTrainRoute}`); // <-- ADD THIS LOG
        if (currentAppMode === 'train' && currentTrainRoute) {
            fetchAndProcessDepartures(currentTrainRoute);
        } else {
             // This should ideally not happen if stopTrainPolling is called correctly on mode change
             console.warn(`[Train Polling] Interval fired but conditions not met (Mode: ${currentAppMode}, Route: ${currentTrainRoute ? currentTrainRoute.fromCRS : 'None'}). Stopping poll.`);
             stopTrainPolling();
        }
    }, POLLING_INTERVAL_MS);
};

const stopTrainPolling = () => {
    if (trainPollingInterval) {
        console.log('[Train Polling] Stopping polling.');
        clearInterval(trainPollingInterval);
        trainPollingInterval = null;
    }
    // Don't reset currentTrainRoute here, keep it so we can resume if user switches back
    // Don't reset currentTrainRoute here, keep it so we can resume if user switches back
    // currentTrainRoute = null;
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
        // updateDisplayAndBroadcast(' '.repeat(SPLITFLAP_DISPLAY_LENGTH)); // Use constant
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
    // isSequencePlaying = false; // stopAllTimedModes should handle this
    io.emit('sequenceStopped'); // Inform clients
};

// --- Home Assistant MQTT Integration ---

// Function to publish the current train route state to MQTT
const publishTrainRouteState = () => {
    if (!mqttClient.getDisplayConnectionStatus().status.startsWith('connect')) return; // Only publish if connected

    const fromState = currentTrainRoute?.fromCRS ?? "";
    const toState = currentTrainRoute?.toCRS ?? "";

    console.log(`[HA MQTT] Publishing Train Route State: From='${fromState}', To='${toState}'`);
    mqttClient.publish(haTrainFromStateTopic, fromState, { retain: true });
    mqttClient.publish(haTrainToStateTopic, toState, { retain: true });
};

// Function to publish the current timer target duration state to MQTT
const publishTimerState = () => {
    if (!mqttClient.getDisplayConnectionStatus().status.startsWith('connect')) return;

    // Publish target duration in minutes
    const durationMinutes = Math.round(timerTargetMs / 60000); // Convert ms to minutes for HA number entity
    console.log(`[HA MQTT] Publishing Timer Duration State: ${durationMinutes} min`);
    mqttClient.publish(haTimerDurationStateTopic, durationMinutes.toString(), { retain: true });

    // Note: We don't publish the running state separately here,
    // as the start/stop is controlled by a button.
};


const publishHaDiscoveryConfig = () => {
    if (haDiscoveryPublished) return; // Only publish once per connection usually

    const devicePayload = {
        identifiers: [HA_DEVICE_ID],
        name: HA_DEVICE_NAME,
        manufacturer: "Split-Flap Controller Backend",
        model: "Software Controller v1.0",
        sw_version: "1.0.0", // Example version
        // Availability is defined at the entity level, not needed here
    };

    // Define origin info (recommended for discovery)
    const originPayload = {
        name: "splitflap-controller-backend", // Name of this software
        sw_version: "1.0.0", // Example version
        // support_url: "https://github.com/your-repo/splitflap-controller", // Removed optional URL
    };


    const configPayload = {
        name: HA_MODE_SELECTOR_NAME, // Name shown in HA UI
        unique_id: HA_MODE_SELECTOR_ID, // Unique ID for this entity
        object_id: HA_MODE_SELECTOR_ID, // Add object_id, often same as unique_id
        device: devicePayload, // Link to the device
        state_topic: haModeStateTopic, // Topic to read the current mode from
        command_topic: haModeCommandTopic, // Topic to send mode change commands to
        options: HA_MODES, // List of available modes
        qos: 0, // Quality of Service for commands/state
        retain: true, // Retain the config message so HA finds it on restart
        // Add availability topic for the select entity
        availability_topic: HA_AVAILABILITY_TOPIC,
        payload_available: "online",
        payload_not_available: "offline",
        // Add origin information
        origin: originPayload,
        platform: "select",
    };

    // --- Train From Text Entity Config ---
    const trainFromConfigPayload = {
        platform: "text",
        name: HA_TRAIN_FROM_NAME,
        unique_id: HA_TRAIN_FROM_ID,
        object_id: HA_TRAIN_FROM_ID,
        device: devicePayload, // Link to the same device
        availability_topic: HA_AVAILABILITY_TOPIC, // Use shared availability
        state_topic: haTrainFromStateTopic,
        command_topic: haTrainFromCommandTopic,
        entity_category: "config", // Configuration entity
        pattern: "^[A-Za-z]{3}$", // Require 3 letters
        qos: 0,
        retain: true, // Retain config
        origin: originPayload, // Add origin info
    };

    // --- Train To Text Entity Config ---
    const trainToConfigPayload = {
        platform: "text",
        name: HA_TRAIN_TO_NAME,
        unique_id: HA_TRAIN_TO_ID,
        object_id: HA_TRAIN_TO_ID,
        device: devicePayload,
        availability_topic: HA_AVAILABILITY_TOPIC,
        state_topic: haTrainToStateTopic,
        command_topic: haTrainToCommandTopic,
        entity_category: "config",
        pattern: "^([A-Za-z]{3})?$", // Allow empty or 3 letters
        qos: 0,
        retain: true,
        origin: originPayload,
    };

    // --- Train Update Button Entity Config ---
    const trainUpdateConfigPayload = {
        platform: "button",
        name: HA_TRAIN_UPDATE_NAME,
        unique_id: HA_TRAIN_UPDATE_ID,
        object_id: HA_TRAIN_UPDATE_ID,
        device: devicePayload,
        availability_topic: HA_AVAILABILITY_TOPIC,
        command_topic: haTrainUpdateCommandTopic, // Topic to trigger the button press
        entity_category: "config",
        qos: 0,
        // Buttons typically don't retain config or have state
        origin: originPayload,
    };

    console.log(`[HA MQTT] Publishing discovery config for Select: ${haModeConfigTopic}`);
    mqttClient.publish(haModeConfigTopic, JSON.stringify(configPayload), { retain: true });

    console.log(`[HA MQTT] Publishing discovery config for Train From: ${haTrainFromConfigTopic}`);
    mqttClient.publish(haTrainFromConfigTopic, JSON.stringify(trainFromConfigPayload), { retain: true });

    console.log(`[HA MQTT] Publishing discovery config for Train To: ${haTrainToConfigTopic}`);
    mqttClient.publish(haTrainToConfigTopic, JSON.stringify(trainToConfigPayload), { retain: true });

    console.log(`[HA MQTT] Publishing discovery config for Train Update Button: ${haTrainUpdateConfigTopic}`);
    mqttClient.publish(haTrainUpdateConfigTopic, JSON.stringify(trainUpdateConfigPayload), { retain: true });

    // --- Stopwatch Start/Stop Button Entity Config ---
    const stopwatchStartStopConfigPayload = {
        platform: "button",
        name: HA_STOPWATCH_START_STOP_NAME, // Use new name
        unique_id: HA_STOPWATCH_START_STOP_ID, // Use new ID
        object_id: HA_STOPWATCH_START_STOP_ID, // Use new ID
        device: devicePayload,
        availability_topic: HA_AVAILABILITY_TOPIC,
        command_topic: haStopwatchStartStopCommandTopic, // Use new command topic
        icon: "mdi:play-pause", // Icon suggesting toggle behavior
        entity_category: "config",
        qos: 0,
        // Buttons don't have state or retain config typically
        origin: originPayload,
    };

    // --- Stopwatch Reset Button Entity Config --- (Keep as is)
    const stopwatchResetConfigPayload = {
        platform: "button",
        name: HA_STOPWATCH_RESET_NAME,
        unique_id: HA_STOPWATCH_RESET_ID,
        object_id: HA_STOPWATCH_RESET_ID,
        device: devicePayload,
        availability_topic: HA_AVAILABILITY_TOPIC,
        command_topic: haStopwatchResetCommandTopic,
        icon: "mdi:timer-refresh-outline",
        entity_category: "config",
        qos: 0,
        origin: originPayload,
    };

    console.log(`[HA MQTT] Publishing discovery config for Stopwatch Start/Stop Button: ${haStopwatchStartStopConfigTopic}`); // Update log message
    mqttClient.publish(haStopwatchStartStopConfigTopic, JSON.stringify(stopwatchStartStopConfigPayload), { retain: true }); // Use new variables

    console.log(`[HA MQTT] Publishing discovery config for Stopwatch Reset Button: ${haStopwatchResetConfigTopic}`); // Keep reset button
    mqttClient.publish(haStopwatchResetConfigTopic, JSON.stringify(stopwatchResetConfigPayload), { retain: true });

    // --- Timer Duration Number Entity Config ---
    const timerDurationConfigPayload = {
        platform: "number",
        name: HA_TIMER_DURATION_NAME,
        unique_id: HA_TIMER_DURATION_ID,
        object_id: HA_TIMER_DURATION_ID,
        device: devicePayload,
        availability_topic: HA_AVAILABILITY_TOPIC,
        state_topic: haTimerDurationStateTopic,
        command_topic: haTimerDurationCommandTopic,
        entity_category: "config",
        icon: "mdi:timer-cog-outline",
        mode: "box", // Use box input mode
        min: 1,      // Minimum 1 minute
        max: 120,    // Maximum 120 minutes (adjust as needed)
        step: 1,     // Step by 1 minute
        unit_of_measurement: "min",
        qos: 0,
        retain: true, // Retain config
        origin: originPayload,
    };

    // --- Timer Start/Stop Button Entity Config ---
    const timerStartStopConfigPayload = {
        platform: "button",
        name: HA_TIMER_START_STOP_NAME,
        unique_id: HA_TIMER_START_STOP_ID,
        object_id: HA_TIMER_START_STOP_ID,
        device: devicePayload,
        availability_topic: HA_AVAILABILITY_TOPIC,
        command_topic: haTimerStartStopCommandTopic,
        icon: "mdi:play-pause",
        entity_category: "config",
        qos: 0,
        origin: originPayload,
    };

    console.log(`[HA MQTT] Publishing discovery config for Timer Duration Number: ${haTimerDurationConfigTopic}`);
    mqttClient.publish(haTimerDurationConfigTopic, JSON.stringify(timerDurationConfigPayload), { retain: true });

    console.log(`[HA MQTT] Publishing discovery config for Timer Start/Stop Button: ${haTimerStartStopConfigTopic}`);
    mqttClient.publish(haTimerStartStopConfigTopic, JSON.stringify(timerStartStopConfigPayload), { retain: true });

    // --- Timer Set Button Entity Config ---
    const timerSetConfigPayload = {
        platform: "button",
        name: HA_TIMER_SET_NAME,
        unique_id: HA_TIMER_SET_ID,
        object_id: HA_TIMER_SET_ID,
        device: devicePayload,
        availability_topic: HA_AVAILABILITY_TOPIC,
        command_topic: haTimerSetCommandTopic,
        icon: "mdi:check-circle-outline", // Icon indicating confirmation/setting
        entity_category: "config",
        qos: 0,
        origin: originPayload,
    };

    console.log(`[HA MQTT] Publishing discovery config for Timer Set Button: ${haTimerSetConfigTopic}`);
    mqttClient.publish(haTimerSetConfigTopic, JSON.stringify(timerSetConfigPayload), { retain: true });


    haDiscoveryPublished = true; // Mark as published for this connection cycle
};

const handleMqttMessage = (topic: string, message: Buffer) => {
    const messageStr = message.toString();
    console.log(`[MQTT Handler] Received message on topic ${topic}: ${messageStr}`);

    if (topic === 'internal/connect') {
        // MQTT client connected/reconnected
        haDiscoveryPublished = false; // Reset flag on new connection
        publishHaDiscoveryConfig(); // Publish all configs (select, text, button)

        // Subscribe to command topics
        mqttClient.subscribe(haModeCommandTopic);
        mqttClient.subscribe(haTrainFromCommandTopic);
        mqttClient.subscribe(haTrainToCommandTopic);
        mqttClient.subscribe(haTrainUpdateCommandTopic);
        mqttClient.subscribe(haStopwatchStartStopCommandTopic);
        mqttClient.subscribe(haStopwatchResetCommandTopic);
        mqttClient.subscribe(haTimerDurationCommandTopic);
        mqttClient.subscribe(haTimerStartStopCommandTopic);
        mqttClient.subscribe(haTimerSetCommandTopic); // Subscribe to timer set button

        publishTrainRouteState(); // Publish initial train route state
        publishTimerState(); // Publish initial timer state
        // No initial stopwatch state to publish for buttons
        mqttClient.publish(HA_AVAILABILITY_TOPIC, 'online', { retain: true }); // Publish availability

    } else if (topic === haModeCommandTopic) {
        // --- Handle Mode Change Command ---
        const requestedMode = messageStr as ControlMode;
        if (HA_MODES.includes(requestedMode)) {
            console.log(`[HA MQTT] Received mode command: ${requestedMode}`);
            setBackendMode(requestedMode, 'mqtt'); // Use the refactored function
        } else {
            console.warn(`[HA MQTT] Received invalid mode command: ${requestedMode}`);
        }
    } else if (topic === haTrainFromCommandTopic) {
        // --- Handle Train From CRS Change ---
        const newFromCRS = messageStr.toUpperCase();
        if (/^[A-Z]{3}$/.test(newFromCRS)) {
            console.log(`[HA MQTT] Received Train From CRS command: ${newFromCRS}`);
            if (!currentTrainRoute || currentTrainRoute.fromCRS !== newFromCRS) {
                currentTrainRoute = { ...(currentTrainRoute ?? { fromCRS: '' }), fromCRS: newFromCRS };
                publishTrainRouteState(); // Publish updated state back to HA
                // Optionally trigger update if in train mode?
                if (currentAppMode === 'train') {
                    fetchAndProcessDepartures(currentTrainRoute);
                }
            }
        } else {
            console.warn(`[HA MQTT] Received invalid Train From CRS command: ${messageStr}. Ignoring.`);
            // Optionally publish the *old* state back to reset HA's input
            publishTrainRouteState();
        }
    } else if (topic === haTrainToCommandTopic) {
        // --- Handle Train To CRS Change ---
        const newToCRS = messageStr.toUpperCase();
         if (/^([A-Z]{3})?$/.test(newToCRS)) { // Allow empty or 3 letters
            console.log(`[HA MQTT] Received Train To CRS command: ${newToCRS || '(empty)'}`);
            const toValue = newToCRS || undefined; // Store undefined if empty
             if (!currentTrainRoute || currentTrainRoute.toCRS !== toValue) {
                currentTrainRoute = { ...(currentTrainRoute ?? { fromCRS: '' }), toCRS: toValue };
                publishTrainRouteState(); // Publish updated state back to HA
                 // Optionally trigger update if in train mode?
                if (currentAppMode === 'train') {
                    fetchAndProcessDepartures(currentTrainRoute);
                }
            }
        } else {
            console.warn(`[HA MQTT] Received invalid Train To CRS command: ${messageStr}. Ignoring.`);
            // Optionally publish the *old* state back to reset HA's input
            publishTrainRouteState();
        }
    } else if (topic === haTrainUpdateCommandTopic) {
        // --- Handle Train Update Button Press ---
        console.log(`[HA MQTT] Received Train Update button press.`);
        if (currentAppMode === 'train' && currentTrainRoute) {
            console.log(`[HA MQTT] Triggering train departure fetch for ${currentTrainRoute.fromCRS}...`);
            fetchAndProcessDepartures(currentTrainRoute);
        } else {
            console.log(`[HA MQTT] Ignoring Train Update button press (Mode: ${currentAppMode}, Route: ${!!currentTrainRoute})`);
        }
    } else if (topic === haStopwatchStartStopCommandTopic) {
        // --- Handle Stopwatch Start/Stop Button Press ---
        console.log(`[HA MQTT] Received Stopwatch Start/Stop button press.`);
        if (currentAppMode === 'stopwatch') {
            if (isStopwatchRunning) {
                console.log(`[HA MQTT] Stopwatch is running, stopping it.`);
                stopBackendStopwatch();
            } else {
                console.log(`[HA MQTT] Stopwatch is stopped, starting it.`);
                startBackendStopwatch();
            }
        } else {
            // More specific log when ignoring due to mode mismatch
            console.log(`[HA MQTT] Ignoring Stopwatch Start/Stop button press because current mode is '${currentAppMode}' (expected 'stopwatch')`);
        }
    } else if (topic === haStopwatchResetCommandTopic) {
        // --- Handle Stopwatch Reset Button Press ---
        console.log(`[HA MQTT] Received Stopwatch Reset button press.`);
        if (currentAppMode === 'stopwatch') {
             resetBackendStopwatch();
        } else {
            // More specific log when ignoring due to mode mismatch
            console.log(`[HA MQTT] Ignoring Stopwatch Reset button press because current mode is '${currentAppMode}' (expected 'stopwatch')`);
        }
    }
    // Add handlers for other subscribed topics if needed
};


// --- Socket.IO Connection Handling ---
io.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}. Setting up listeners...`); // Added detail

    try { // Add try block
        console.log(`[Socket.IO] Emitting initialState for ${socket.id}...`);
        // Send current state to newly connected client
        socket.emit('initialState', {
            text: currentDisplayText,
            mode: currentAppMode,
            stopwatch: { // Restore stopwatch state
                elapsedTime: stopwatchElapsedTime,
                isRunning: isStopwatchRunning,
            },
            timer: { // Restore timer state
                targetMs: timerTargetMs,
                remainingMs: timerRemainingMs,
                isRunning: timerIsRunning,
            },
            sequence: { // Restore sequence state
                isPlaying: isSequencePlaying,
            },
        train: { // Restore train state
            route: currentTrainRoute,
            departures: lastFetchedDepartures,
        }
        });
        console.log(`[Socket.IO] Successfully emitted initialState for ${socket.id}.`); // <-- ADD THIS LOG

        console.log(`[Socket.IO] Emitting mqttStatus for ${socket.id}...`);
        socket.emit('mqttStatus', mqttClient.getDisplayConnectionStatus()); // Send MQTT status
        console.log(`[Socket.IO] Successfully emitted mqttStatus for ${socket.id}.`); // <-- ADD THIS LOG

    } catch (error) { // Add catch block
        console.error(`[Socket.IO] Error emitting initial state or status for ${socket.id}:`, error);
        // Optionally disconnect the client if initial state fails critically
        // socket.disconnect(true);
    }

    console.log(`[Socket.IO] Setting up event listeners for ${socket.id}...`); // Added log
    // --- Handle events from the client ---

    socket.on('getMqttStatus', () => {
        socket.emit('mqttStatus', mqttClient.getDisplayConnectionStatus());
    });

    // Use the refactored mode setting function
    socket.on('setMode', (mode: ControlMode) => {
        console.log(`[Socket.IO] Received setMode: ${mode} from ${socket.id}`);
        setBackendMode(mode, 'socket');
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

    // --- Timer Handlers ---
    socket.on('setTimer', (data: { durationMs: number }) => {
        console.log(`[Socket.IO] Received setTimer: ${data.durationMs}ms from ${socket.id}.`);
        if (currentAppMode === 'timer') {
            setBackendTimer(data.durationMs);
        }
    });
    socket.on('startTimer', () => {
        console.log(`[Socket.IO] Received startTimer from ${socket.id}.`);
        if (currentAppMode === 'timer') {
            startBackendTimer();
        }
    });
    socket.on('stopTimer', () => {
        console.log(`[Socket.IO] Received stopTimer from ${socket.id}.`);
        if (currentAppMode === 'timer') {
            stopBackendTimer();
        }
    });
    // --- End Timer Handlers ---


    socket.on('startTrainUpdates', (data: { fromCRS: string; toCRS?: string }) => {
        console.log(`[Socket.IO] Received startTrainUpdates: ${data.fromCRS} -> ${data.toCRS || 'any'} from ${socket.id}`);
        if (currentAppMode === 'train') {
            // Only process if the route is valid
            if (data.fromCRS && data.fromCRS.length === 3) {
                const newRoute = { fromCRS: data.fromCRS, toCRS: data.toCRS || undefined };
                // Update route state *before* starting poll and publish to MQTT
                currentTrainRoute = newRoute;
                publishTrainRouteState(); // Publish new route state to HA
                startTrainPolling(newRoute); // Start polling with the new route
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

    socket.on('disconnect', (reason) => { // Add reason parameter
        console.log(`[Socket.IO] Client disconnected: ${socket.id}. Reason: ${reason}`); // Log reason
    });

    // Add a listener for socket-level errors
    socket.on('error', (error) => {
        console.error(`[Socket.IO] Socket error for client ${socket.id}:`, error);
    });

    console.log(`[Socket.IO] Event listeners successfully set up for ${socket.id}.`); // <-- ADD THIS LOG
});

// Add a listener for server-level connection errors
io.engine.on("connection_error", (err) => {
    console.error("[Socket.IO Engine] Connection Error:");
    console.error("  Code:", err.code);
    console.error("  Message:", err.message);
    if (err.context) {
        console.error("  Context:", err.context);
    }
});

// --- Start Servers ---
httpServer.listen(port, () => {
    console.log(`[Server] HTTP & WebSocket server listening on http://localhost:${port}`);
    // Connect to MQTT and pass the message handler and availability topic
    mqttClient.connectToDisplayBroker(handleMqttMessage, HA_AVAILABILITY_TOPIC);
});
