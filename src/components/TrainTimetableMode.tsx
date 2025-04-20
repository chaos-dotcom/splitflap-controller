import React from 'react';
import './TrainTimetableMode.css'; // We'll create this CSS file next

interface TrainTimetableModeProps {
    isConnected: boolean;
    onSendMessage: (message: string) => void;
}

const TrainTimetableMode: React.FC<TrainTimetableModeProps> = ({ isConnected, onSendMessage }) => {

    // Placeholder function for when train data is selected/ready
    const handleSendTrainInfo = () => {
        if (!isConnected) return;
        // TODO: Get actual train data from state/inputs
        const trainInfoString = "TRAIN MODE.."; // Placeholder
        onSendMessage(trainInfoString);
    };

    return (
        <div className="train-timetable-mode">
            <h4>Train Timetable Controls</h4>
            <p>(Train timetable UI will go here)</p>
            {/* Example: Placeholder for station inputs */}
            <div>
                <label>From: </label><input type="text" placeholder="e.g., London Euston" disabled={!isConnected} />
            </div>
            <div>
                <label>To: </label><input type="text" placeholder="e.g., Manchester Picc" disabled={!isConnected} />
            </div>
            <button onClick={handleSendTrainInfo} disabled={!isConnected}>
                Send Train Info
            </button>
             <p style={{fontSize: '0.8em', color: '#666'}}>
                Note: This requires a backend service to fetch real train data (not implemented yet).
            </p>
        </div>
    );
};

export default TrainTimetableMode;
