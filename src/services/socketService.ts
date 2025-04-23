import { io, Socket } from 'socket.io-client';
import { ControlMode, Scene, Departure, TrainRoutePreset } from '../types';

// Define the structure of events from the backend
interface ServerToClientEvents {
    connect: () => void;
    disconnect: (reason: string) => void;
    connect_error: (error: Error) => void;
    initialState: (state: {
        text: string;
        mode: ControlMode;
        stopwatch?: { isRunning: boolean; elapsedTime: number };
        timer?: { // Add timer state
            targetMs: number;
            remainingMs: number;
            isRunning: boolean;
        };
            sequence?: { isPlaying: boolean };
            train?: { // Add train initial state
                route: { fromCRS: string; toCRS?: string } | null;
                departures: Departure[];
            };
            // Note: Initial scene list/data might be better fetched explicitly after connect
        }) => void;
        displayUpdate: (data: { text: string }) => void;
        modeUpdate: (data: { mode: ControlMode }) => void;
        mqttStatus: (status: { status: string; error: string | null }) => void;
        stopwatchUpdate: (data: { elapsedTime: number; isRunning: boolean }) => void;
        trainDataUpdate: (data: { departures?: Departure[]; error?: string }) => void; // Event for train data updates/errors
        timerUpdate: (data: { targetMs: number; remainingMs: number; isRunning: boolean }) => void; // Event for timer updates
        sequenceStopped: () => void;
        // --- Scene Management Events (Server -> Client) ---
        sceneListUpdate: (data: { names: string[] }) => void; // Backend sends the list of scene names
        sceneLoaded: (data: { scene: Scene }) => void; // Backend sends the data for a loaded scene
        // --- End Scene Management Events ---
        error: (data: { message: string }) => void; // General backend errors
}

// Define the structure of events sent to the backend
interface ClientToServerEvents {
    getMqttStatus: () => void;
    setMode: (mode: ControlMode) => void;
    setText: (data: { text: string }) => void;
    // startClock: () => void; // Backend handles clock start implicitly on mode change
    startStopwatch: () => void;
    stopStopwatch: () => void;
    resetStopwatch: () => void;
    playSequence: (data: { scene: Scene; loop: boolean }) => void; // Add loop parameter
    stopSequence: () => void;
    setTimer: (data: { durationMs: number }) => void; // Event to set timer duration
    startTimer: () => void; // Event to start timer
    stopTimer: () => void; // Event to stop timer
    // resetTimer: () => void; // Optional: Could just use setTimer with original target
    startTrainUpdates: (data: { fromCRS: string; toCRS?: string }) => void; // Event to start/update train polling
    // --- Scene Management Events (Client -> Server) ---
    getSceneList: () => void; // Request the list of scene names
    loadScene: (data: { sceneName: string }) => void; // Request loading a specific scene
    saveScene: (data: { sceneName: string; sceneData: Scene }) => void; // Send scene data to be saved
    deleteScene: (data: { sceneName: string }) => void; // Request deletion of a scene
    // --- End Scene Management Events ---
}

// Define the socket type
type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

// Ensure this points to your running backend server
const BACKEND_URL = 'http://localhost:3001';

export const socketService = {
    connect: (
        onInitialState: (state: Parameters<ServerToClientEvents['initialState']>[0]) => void, // Corrected type
        onDisplayUpdate: (data: Parameters<ServerToClientEvents['displayUpdate']>[0]) => void, // Corrected type
        onModeUpdate: (data: Parameters<ServerToClientEvents['modeUpdate']>[0]) => void,
        onMqttStatus: (status: Parameters<ServerToClientEvents['mqttStatus']>[0]) => void,
        onStopwatchUpdate: (data: Parameters<ServerToClientEvents['stopwatchUpdate']>[0]) => void,
        onTimerUpdate: (data: Parameters<ServerToClientEvents['timerUpdate']>[0]) => void, // Add callback for timer
        onTrainDataUpdate: (data: Parameters<ServerToClientEvents['trainDataUpdate']>[0]) => void, // Add callback for train data
        onSequenceStopped: () => void,
        // --- Scene Management Callbacks ---
        onSceneListUpdate: (data: Parameters<ServerToClientEvents['sceneListUpdate']>[0]) => void,
        onSceneLoaded: (data: Parameters<ServerToClientEvents['sceneLoaded']>[0]) => void,
        // --- End Scene Management Callbacks ---
        onConnect: () => void,
        onDisconnect: (reason: string) => void,
        onError: (message: string) => void
    ): void => {
        // --- ADD LOGGING ---
        console.log('[Socket.IO Service] connect() function called.');
        // --- END LOGGING ---

        // --- MODIFIED CHECK ---
        // Only proceed if socket is truly null (not just disconnected)
        if (socket !== null) {
            // --- UPDATED LOG ---
            console.log('[Socket.IO Service] Connection attempt ignored, socket instance already exists.');
            // --- END UPDATED LOG ---
            // If it's disconnected and you want connect to retry, call disconnect() first.
            // For now, we rely on the initial useEffect mount.
            return;
        }
        // --- END MODIFIED CHECK ---


        // --- UPDATED LOG ---
        console.log(`[Socket.IO Service] Attempting to create io instance for ${BACKEND_URL}...`);
        // --- END UPDATED LOG ---

        // --- REMOVE RECONNECTION OPTIONS TEMPORARILY ---
        // --- ADD WEBSOCKET TRANSPORT OPTION ---
        try { // <-- Add try block around io() call
            socket = io(BACKEND_URL, {
                 // withCredentials: true, // Keep removed
                 autoConnect: false,
                 transports: ['websocket'] // <-- ADD THIS LINE BACK
            });
            // --- ADD LOG ---
            console.log('[Socket.IO Service] io instance created successfully (forcing websocket, autoConnect: false).'); // Update log
            // --- END LOG ---
        } catch (error) { // <-- Add catch block
            console.error('[Socket.IO Service] Error creating io instance:', error);
            onError(`Failed to initialize Socket.IO: ${error instanceof Error ? error.message : String(error)}`);
            socket = null; // Ensure socket is null if creation failed
            return; // Stop further execution if io() fails
        }
        // --- END ADDITION ---


        // --- Attach listeners (Keep this block uncommented from previous step) ---
        // --- ADD LOG ---
        console.log('[Socket.IO Service] Attaching base listeners (connect, disconnect, connect_error)...');
        // --- END LOG ---
        socket.on('connect', () => {
            // --- ADD LOG ---
            console.log(`[Socket.IO Service] 'connect' event received: ${socket?.id}`);
            // --- END LOG ---
            onConnect();
        });

        socket.on('disconnect', (reason) => {
            // --- ADD LOG ---
            console.log(`[Socket.IO Service] 'disconnect' event received: ${reason}`);
            // --- END LOG ---
            // --- ADD NULLIFICATION ON DISCONNECT ---
            // Setting socket to null here ensures a new instance is created on next connect() call
            // Note: This might interfere with automatic reconnection if it were enabled.
            // socket = null; // Let's try nullifying in disconnect() method instead for better control.
            // --- END ADDITION ---
            onDisconnect(reason);
        });

        // Use a local variable for onError to avoid potential closure issues if it changes
        const handleErrorCallback = onError;
        socket.on('connect_error', (error) => {
            // --- ADD LOG ---
            console.error('[Socket.IO Service] \'connect_error\' event received:', error.message);
            // --- END LOG ---
            if (handleErrorCallback) {
                handleErrorCallback(`Connection failed: ${error.message}`);
            } else {
                console.error('[Socket.IO Service] onError callback is not defined when connect_error occurred.');
            }
            // --- ADD NULLIFICATION ON CONNECTION ERROR ---
            // If connection fails outright, nullify to allow a fresh attempt later
            socket = null;
            // --- END ADDITION ---
        });
        // --- ADD LOG ---
        console.log('[Socket.IO Service] Base listeners attached.');
        // --- END LOG ---

        // --- Attach listeners ---
        // Remove the /* and */ surrounding this block
        // --- UPDATED LOG ---
        console.log('[Socket.IO Service] Attaching application event listeners...');
        // --- END UPDATED LOG ---
        socket.on('initialState', onInitialState);
        socket.on('displayUpdate', onDisplayUpdate);
        socket.on('modeUpdate', onModeUpdate);
        socket.on('mqttStatus', onMqttStatus);
        socket.on('stopwatchUpdate', onStopwatchUpdate);
        socket.on('timerUpdate', onTimerUpdate); // Listen for timer updates
        socket.on('trainDataUpdate', onTrainDataUpdate); // Listen for train data updates
        socket.on('sequenceStopped', onSequenceStopped);
        // --- Scene Management Listeners ---
        socket.on('sceneListUpdate', onSceneListUpdate);
        socket.on('sceneLoaded', onSceneLoaded);
        // --- End Scene Management Listeners ---
        // Note: The 'error' event here is for *backend-emitted* errors, distinct from 'connect_error'
        socket.on('error', (data) => onError(data.message)); // Use the onError callback passed in
        // --- UPDATED LOG ---
        console.log('[Socket.IO Service] Application event listeners attached.');
        // --- END UPDATED LOG ---
        // --- END RESTORED LISTENERS ---

        // --- Manually initiate connection ---
        console.log('[Socket.IO Service] Manually calling socket.connect()...'); // <-- ADD LOG
        socket.connect(); // <-- ADD THIS LINE

    }, // End of connect function

    disconnect: (): void => {
        if (socket) {
            console.log('[Socket.IO] Disconnecting from backend...');
            socket.disconnect();
            // --- ADD NULLIFICATION ---
            socket = null; // Ensure the instance is cleared
            // --- END ADDITION ---
        }
    },

    isConnected: (): boolean => {
        return socket?.connected ?? false;
    },

    // --- Emitter Functions ---
    emit: <T extends keyof ClientToServerEvents>(event: T, ...args: Parameters<ClientToServerEvents[T]>) => {
        if (socket && socket.connected) {
            // console.log(`[Socket.IO] Emitting ${event}`, args); // Uncomment for debugging emits
            // Using any assertion temporarily as mapping complex args can be tricky
            (socket as any).emit(event, ...args);
        } else {
            console.warn(`[Socket.IO] Cannot emit ${event}: Not connected.`);
            // Optionally notify user or queue event
        }
    },

    // Convenience emitters
    emitGetMqttStatus: () => socketService.emit('getMqttStatus'),
    emitSetMode: (mode: ControlMode) => socketService.emit('setMode', mode),
    emitSetText: (text: string) => socketService.emit('setText', { text }),
    emitStartStopwatch: () => socketService.emit('startStopwatch'),
    emitStopStopwatch: () => socketService.emit('stopStopwatch'),
    emitResetStopwatch: () => socketService.emit('resetStopwatch'),
    // Update emitPlaySequence to include loop
    emitPlaySequence: (scene: Scene, loop: boolean) => socketService.emit('playSequence', { scene, loop }),
    emitStopSequence: () => socketService.emit('stopSequence'),
    emitSetTimer: (durationMs: number) => socketService.emit('setTimer', { durationMs }),
    emitStartTimer: () => socketService.emit('startTimer'),
    emitStopTimer: () => socketService.emit('stopTimer'),
    // emitResetTimer: () => socketService.emit('resetTimer'), // Optional
    emitStartTrainUpdates: (fromCRS: string, toCRS?: string) => socketService.emit('startTrainUpdates', { fromCRS, toCRS }),
    // --- Scene Management Emitters ---
    emitGetSceneList: () => socketService.emit('getSceneList'),
    emitLoadScene: (sceneName: string) => socketService.emit('loadScene', { sceneName }),
    emitSaveScene: (sceneName: string, sceneData: Scene) => socketService.emit('saveScene', { sceneName, sceneData }),
    emitDeleteScene: (sceneName: string) => socketService.emit('deleteScene', { sceneName }),
    // --- End Scene Management Emitters ---

};
