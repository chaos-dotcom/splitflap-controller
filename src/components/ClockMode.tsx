import React, { useState, useEffect, useRef } from 'react';
import { DISPLAY_LENGTH } from '../constants';
import './ClockMode.css';

interface ClockModeProps {
    isConnected: boolean;
    onSendMessage: (message: string) => void;
    isActive: boolean; // Prop to know if this mode is currently selected
}

// Helper function to format the date
const formatTime = (date: Date): string => {
    const optionsWeekday: Intl.DateTimeFormatOptions = { weekday: 'short' };
    const optionsTime: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: 'numeric', hour12: true };

    // Get parts - handle potential inconsistencies across locales/browsers if needed
    const weekday = date.toLocaleDateString('en-US', optionsWeekday).substring(0, 3); // Ensure 3 chars like 'Mon'
    let hour = date.getHours();
    const minute = date.getMinutes();
    const ampm = hour >= 12 ? 'PM' : 'AM';

    hour = hour % 12;
    hour = hour ? hour : 12; // Handle midnight (0 becomes 12)

    const hourStr = hour.toString().padStart(2, '0'); // Pad with ZERO for single digit hours
    const minuteStr = minute.toString().padStart(2, '0'); // Pad minutes with zero like %M

    // Format: 'DDD HHMM AP ' (12 chars total)
    const formatted = `${weekday} ${hourStr}${minuteStr}  ${ampm}`;

    // Ensure uppercase and exactly DISPLAY_LENGTH
    return formatted.toUpperCase().padEnd(DISPLAY_LENGTH).substring(0, DISPLAY_LENGTH);
};


const ClockMode: React.FC<ClockModeProps> = ({ isConnected, onSendMessage, isActive }) => {
    const [currentTimeString, setCurrentTimeString] = useState<string>(' '.repeat(DISPLAY_LENGTH));
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Function to update time and send message
        const updateClock = () => {
            const now = new Date();
            const formattedTime = formatTime(now);
            setCurrentTimeString(formattedTime); // Update local state for potential display within the component
            if (isConnected && isActive) { // Only send if connected AND this mode is active
                onSendMessage(formattedTime);
            }
        };

        // Clear any existing interval when isActive or isConnected changes
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        // Start interval only if this mode is active
        if (isActive) {
            updateClock(); // Update immediately when activated
            intervalRef.current = setInterval(updateClock, 1000); // Update every second
        }

        // Cleanup function to clear interval on unmount or when isActive becomes false
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isActive, isConnected, onSendMessage]); // Rerun effect if isActive or isConnected changes

    return (
        <div className="clock-mode">
            <h4 className="draggable-handle">Clock Mode</h4>
            <p>Displaying current time:</p>
            {/* Optionally display the time here too */}
            <code className="current-time-display">{currentTimeString}</code>
            {!isConnected && isActive && (
                 <p className="connection-warning">MQTT Disconnected. Clock running locally.</p>
            )}
        </div>
    );
};

export default ClockMode;
