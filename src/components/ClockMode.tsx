import React from 'react'; // Removed useState, useEffect, useRef
// Removed constants import as formatting happens on backend
import './ClockMode.css';

interface ClockModeProps {
    isConnectedToBackend: boolean; // Renamed prop
    // onSendMessage and isActive removed
}

// Removed formatTime function - formatting now done on backend


const ClockMode: React.FC<ClockModeProps> = ({ isConnectedToBackend }) => {
    // No internal state or timer needed anymore

    return (
        <div className="clock-mode">
            <h4 className="draggable-handle">Clock Mode</h4>
            <p>The main display should show the current time.</p>
            {/* Display is handled by App.tsx based on backend updates */}
            {/* <code className="current-time-display">{...}</code> */}
            {!isConnectedToBackend && (
                 <p className="connection-warning">Disconnected from backend. Clock may not update.</p>
            )}
        </div>
    );
};

export default ClockMode;
