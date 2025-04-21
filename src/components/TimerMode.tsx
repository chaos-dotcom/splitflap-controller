import React, { useState, useEffect } from 'react';
import './TimerMode.css'; // We'll create this next

// Helper function to format milliseconds into MM:SS
const formatTimerTime = (ms: number): string => {
    if (ms < 0) ms = 0; // Ensure time doesn't go negative
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

interface TimerModeProps {
    isConnectedToBackend: boolean;
    isRunningBackend: boolean;
    remainingMsBackend: number;
    targetMsBackend: number; // The initially set duration
    onSetTimer: (durationMinutes: number) => void;
    onStartTimer: () => void;
    onStopTimer: () => void;
}

const TimerMode: React.FC<TimerModeProps> = ({
    isConnectedToBackend,
    isRunningBackend,
    remainingMsBackend,
    // targetMsBackend, // Not directly used in UI for now, but available
    onSetTimer,
    onStartTimer,
    onStopTimer,
}) => {
    const [durationInputMinutes, setDurationInputMinutes] = useState<number>(5); // Default input to 5 minutes

    const handleSetClick = () => {
        if (!isConnectedToBackend || isRunningBackend) return; // Don't set while running
        onSetTimer(durationInputMinutes);
    };

    const handleStartStopClick = () => {
        if (!isConnectedToBackend) return;
        if (isRunningBackend) {
            onStopTimer();
        } else {
            // Only start if remaining time is greater than 0
            if (remainingMsBackend > 0) {
                onStartTimer();
            } else {
                // Optionally set the timer again if trying to start at 0
                onSetTimer(durationInputMinutes);
                // Consider auto-starting after set? For now, require separate start click.
            }
        }
    };

    // Disable start/stop if disconnected OR if timer is at 0 and not running
    const isStartStopDisabled = !isConnectedToBackend || (!isRunningBackend && remainingMsBackend <= 0);
    // Disable set button if disconnected or timer is running
    const isSetDisabled = !isConnectedToBackend || isRunningBackend;

    return (
        <div className="timer-mode">
            <h4 className="draggable-handle govuk-heading-m">Timer Mode</h4>
            <div className="timer-display govuk-body-l">
                {/* Display remaining time formatted */}
                <code>{formatTimerTime(remainingMsBackend)}</code>
            </div>
            <div className="timer-controls govuk-form-group">
                <label className="govuk-label" htmlFor="timer-duration">
                    Set Duration (minutes):
                </label>
                <input
                    className="govuk-input govuk-input--width-5"
                    id="timer-duration"
                    name="timer-duration"
                    type="number"
                    min="1"
                    step="1"
                    value={durationInputMinutes}
                    onChange={(e) => setDurationInputMinutes(parseInt(e.target.value, 10) || 1)}
                    disabled={isSetDisabled}
                />
                <button
                    onClick={handleSetClick}
                    disabled={isSetDisabled}
                    className="govuk-button govuk-button--secondary"
                    data-module="govuk-button"
                    aria-label="Set timer duration"
                >
                    Set
                </button>
            </div>
            <div className="timer-start-stop govuk-button-group">
                 <button
                    onClick={handleStartStopClick}
                    disabled={isStartStopDisabled}
                    className={`govuk-button ${isRunningBackend ? 'govuk-button--warning' : ''}`} // Use warning style for Stop
                    data-module="govuk-button"
                 >
                    {isRunningBackend ? 'Stop' : 'Start'}
                </button>
                {/* Optional Reset Button - could just use Set */}
                {/* <button onClick={handleReset} disabled={!isConnectedToBackend || isRunningBackend}>Reset</button> */}
            </div>
             {!isConnectedToBackend && (
                 <p className="connection-warning govuk-warning-text__text">
                     <span className="govuk-warning-text__icon" aria-hidden="true">!</span>
                     <strong className="govuk-warning-text__assistive">Warning</strong>
                     Disconnected from backend. Timer controls disabled.
                 </p>
            )}
        </div>
    );
};

export default TimerMode;
