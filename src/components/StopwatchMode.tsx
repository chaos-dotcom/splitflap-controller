import React, { useState, useEffect, useRef } from 'react';
import { DISPLAY_LENGTH } from '../constants';
import './StopwatchMode.css';

interface StopwatchModeProps {
    isConnected: boolean;
    onSendMessage: (message: string) => void;
    isActive: boolean; // Prop to know if this mode is currently selected
}

// Helper function to format milliseconds into MM:SS.T
const formatStopwatchTime = (timeMs: number): string => {
    const totalSeconds = Math.floor(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((timeMs % 1000) / 100);

    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toString().padStart(2, '0');
    const t = tenths.toString(); // Single digit

    // Format: "  MM:SS.T   " (12 chars)
    const formatted = `  ${mm}:${ss}.${t}   `;

    // Ensure exactly DISPLAY_LENGTH
    return formatted.padEnd(DISPLAY_LENGTH).substring(0, DISPLAY_LENGTH);
};

const StopwatchMode: React.FC<StopwatchModeProps> = ({ isConnected, onSendMessage, isActive }) => {
    const [elapsedTime, setElapsedTime] = useState<number>(0); // Time in milliseconds
    const [isRunning, setIsRunning] = useState<boolean>(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0); // Timestamp when the stopwatch was last started/resumed

    // Effect to run the timer
    useEffect(() => {
        if (isActive && isRunning) {
            // If running, set up the interval
            intervalRef.current = setInterval(() => {
                const now = Date.now();
                setElapsedTime(now - startTimeRef.current);
            }, 100); // Update every 100ms for tenths of a second display

        } else {
            // If not active or not running, clear the interval
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }

        // Cleanup function
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isActive, isRunning]); // Rerun effect when isActive or isRunning changes

    // Effect to send updates via MQTT when elapsedTime changes and mode is active/connected
    useEffect(() => {
        if (isActive && isConnected) {
            onSendMessage(formatStopwatchTime(elapsedTime));
        }
        // If mode becomes inactive, send a final update or clear message?
        // For now, it just stops sending. The main display will hold the last value.
    }, [elapsedTime, isActive, isConnected, onSendMessage]);

    // Effect to stop the timer if the mode becomes inactive
    useEffect(() => {
        if (!isActive && isRunning) {
            setIsRunning(false); // Stop the timer logic if mode switched away
             if (intervalRef.current) {
                clearInterval(intervalRef.current); // Ensure interval is cleared
                intervalRef.current = null;
            }
        }
    }, [isActive, isRunning]);


    const handleStartStop = () => {
        if (!isConnected) return; // Don't allow control if not connected

        if (isRunning) {
            // Stopping
            setIsRunning(false);
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            // No need to update startTimeRef here, elapsedTime holds the final value
        } else {
            // Starting or Resuming
            startTimeRef.current = Date.now() - elapsedTime; // Adjust start time based on previous elapsed time
            setIsRunning(true);
        }
    };

    const handleReset = () => {
        if (!isConnected) return; // Don't allow control if not connected

        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setIsRunning(false);
        setElapsedTime(0);
        startTimeRef.current = 0; // Reset start time ref
        // Send reset state immediately if connected
        if (isConnected && isActive) {
             onSendMessage(formatStopwatchTime(0));
        }
    };

    const formattedDisplayTime = formatStopwatchTime(elapsedTime);

    return (
        <div className="stopwatch-mode">
            <h4 className="draggable-handle">Stopwatch Mode</h4>
            <div className="stopwatch-display">
                {/* Display time locally */}
                <code>{formattedDisplayTime}</code>
            </div>
            <div className="stopwatch-controls">
                <button onClick={handleStartStop} disabled={!isConnected}>
                    {isRunning ? 'Stop' : 'Start'}
                </button>
                <button onClick={handleReset} disabled={!isConnected || elapsedTime === 0 && !isRunning}>
                    Reset
                </button>
            </div>
             {!isConnected && isActive && (
                 <p className="connection-warning">MQTT Disconnected. Controls disabled.</p>
            )}
        </div>
    );
};

export default StopwatchMode;
