import React from 'react'; // Removed useState, useEffect, useRef
// Removed constants import as formatting happens on backend
import './StopwatchMode.css';

interface StopwatchModeProps {
    isConnectedToBackend: boolean; // Renamed prop
    displayTime: string; // Time string received from backend via App state
    isRunningBackend: boolean; // Whether the backend considers the stopwatch running
    onStart: () => void; // Prop to trigger start event to backend
    onStop: () => void; // Prop to trigger stop event to backend
    onReset: () => void; // Prop to trigger reset event to backend
}

// Removed formatStopwatchTime - formatting done on backend

const StopwatchMode: React.FC<StopwatchModeProps> = ({
    isConnectedToBackend,
    displayTime,
    isRunningBackend,
    onStart,
    onStop,
    onReset
}) => {
    // No internal timer state needed

    const handleStartStop = () => {
        if (!isConnectedToBackend) return;
        if (isRunningBackend) {
            onStop(); // Call the prop function to emit stop event
        } else {
            onStart(); // Call the prop function to emit start event
        }
    };

    const handleReset = () => {
        if (!isConnectedToBackend) return;
        onReset(); // Call the prop function to emit reset event
    };

    // Determine if reset should be disabled (e.g., if time is zero and not running)
    // This check assumes the backend sends a displayTime like "00:00" or similar when reset and stopped.
    // Adjust the condition based on the actual format sent by the backend for the reset state.
    const isTimeZero = displayTime.replace(/[^0-9]/g, '') === '0000'; // Example check for "00:00" or "  00 00   " etc.
    const isResetDisabled = !isConnectedToBackend || (isTimeZero && !isRunningBackend);

    return (
        <div className="stopwatch-mode">
            <h4 className="draggable-handle">Stopwatch Mode</h4>
            <div className="stopwatch-display">
                {/* Display time locally */}
                <code>{displayTime}</code> {/* Display time received from backend */}
            </div>
            {/* Removed Formatting Option */}
            <div className="stopwatch-controls govuk-button-group">
                <button
                    onClick={handleStartStop}
                    disabled={!isConnectedToBackend}
                    className="govuk-button"
                    data-module="govuk-button"
                >
                    {isRunningBackend ? 'Stop' : 'Start'} {/* Use backend running state */}
                </button>
                <button
                    onClick={handleReset}
                    disabled={isResetDisabled}
                    className="govuk-button govuk-button--warning" // Use warning style for reset
                    data-module="govuk-button"
                >
                    Reset
                </button>
            </div>
            {!isConnectedToBackend && (
                 <p className="connection-warning">Disconnected from backend. Controls disabled.</p>
            )}
        </div>
    );
};

export default StopwatchMode;
