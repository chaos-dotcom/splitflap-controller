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
    }) => void;
    displayUpdate: (data: { text: string }) => void;
    modeUpdate: (data: { mode: ControlMode }) => void;
    mqttStatus: (status: { status: string; error: string | null }) => void;
    stopwatchUpdate: (data: { elapsedTime: number; isRunning: boolean }) => void;
    trainDataUpdate: (data: { departures?: Departure[]; error?: string }) => void; // Event for train data updates/errors
    timerUpdate: (data: { targetMs: number; remainingMs: number; isRunning: boolean }) => void; // Event for timer updates
    sequenceStopped: () => void;
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
    playSequence: (data: { scene: Scene }) => void;
    stopSequence: () => void;
    setTimer: (data: { durationMs: number }) => void; // Event to set timer duration
    startTimer: () => void; // Event to start timer
    stopTimer: () => void; // Event to stop timer
    // resetTimer: () => void; // Optional: Could just use setTimer with original target
    startTrainUpdates: (data: { fromCRS: string; toCRS?: string }) => void; // Event to start/update train polling
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
        onConnect: () => void,
        onDisconnect: (reason: string) => void,
        onError: (message: string) => void
    ): void => {
        if (socket && socket.connected) {
            console.log('[Socket.IO] Already connected.');
            return;
        }

        console.log(`[Socket.IO] Connecting to backend at ${BACKEND_URL}...`);
        // Ensure previous connection is cleaned up if exists but disconnected
        if (socket) {
            socket.disconnect();
        }

        socket = io(BACKEND_URL, {
            reconnectionAttempts: 5,
            reconnectionDelay: 3000,
            // Add withCredentials: true if you need cookies/sessions later
        });

        socket.on('connect', () => {
            console.log(`[Socket.IO] Connected to backend: ${socket?.id}`);
            onConnect();
        });

        socket.on('disconnect', (reason) => {
            console.log(`[Socket.IO] Disconnected from backend: ${reason}`);
            onDisconnect(reason);
        });

        // Store the onError callback in a variable accessible within this scope
        const handleError = onError;
        socket.on('connect_error', (error) => {
            console.error('[Socket.IO] Connection Error:', error.message);
            // Call the stored callback function
            if (handleError) {
                handleError(`Connection failed: ${error.message}`);
            } else {
                console.error('[Socket.IO] onError callback is not defined when connect_error occurred.');
            }
            // socket.disconnect(); // Prevent constant reconnect attempts on auth errors etc.
        });

        // Listen for backend events
        socket.on('initialState', onInitialState);
        socket.on('displayUpdate', onDisplayUpdate);
        socket.on('modeUpdate', onModeUpdate);
        socket.on('mqttStatus', onMqttStatus);
        socket.on('stopwatchUpdate', onStopwatchUpdate);
        socket.on('timerUpdate', onTimerUpdate); // Listen for timer updates
        socket.on('trainDataUpdate', onTrainDataUpdate); // Listen for train data updates
        socket.on('sequenceStopped', onSequenceStopped);
        socket.on('error', (data) => onError(data.message));

    },

    disconnect: (): void => {
        if (socket) {
            console.log('[Socket.IO] Disconnecting from backend...');
            socket.disconnect();
            socket = null;
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
    emitPlaySequence: (scene: Scene) => socketService.emit('playSequence', { scene }),
    emitStopSequence: () => socketService.emit('stopSequence'),
    emitSetTimer: (durationMs: number) => socketService.emit('setTimer', { durationMs }),
    emitStartTimer: () => socketService.emit('startTimer'),
    emitStopTimer: () => socketService.emit('stopTimer'),
    // emitResetTimer: () => socketService.emit('resetTimer'), // Optional
    emitStartTrainUpdates: (fromCRS: string, toCRS?: string) => socketService.emit('startTrainUpdates', { fromCRS, toCRS }),

};
