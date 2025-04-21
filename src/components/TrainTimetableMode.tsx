import React, { useState, useEffect } from 'react';
import { DISPLAY_LENGTH } from '../constants'; // Import display length
import './TrainTimetableMode.css';

// Define the structure for departure data (as discussed)
interface Departure {
  id: string;
  scheduledTime: string;
  destination: string;
  platform?: string;
  status: string;
  estimatedTime?: string;
}

// Define the props for the component
interface TrainTimetableModeProps {
    isConnected: boolean;
    onSendMessage: (message: string) => void;
}

const TrainTimetableMode: React.FC<TrainTimetableModeProps> = ({ isConnected, onSendMessage }) => {
    const [fromStation, setFromStation] = useState<string>(''); // e.g., KGX
    const [toStation, setToStation] = useState<string>('');   // e.g., EDB (optional)
    const [departures, setDepartures] = useState<Departure[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false); // Keep loading state for manual refresh
    const [error, setError] = useState<string | null>(null);

    // Function to format a departure into a 12-char string
    const formatDepartureForDisplay = (dep: Departure): string => {
        const time = (dep.estimatedTime && dep.estimatedTime !== 'On time' ? dep.estimatedTime : dep.scheduledTime).replace(':', '');
        let dest = dep.destination.toUpperCase().substring(0, 7); // Max 7 chars for dest
        let plat = dep.platform ? ` ${dep.platform.padStart(1)}` : '  '; // Ensure 2 chars for plat (space + num or 2 spaces)

        if (dep.status.toUpperCase() === 'CANCELLED') {
            return `CANCELLED   `.padEnd(DISPLAY_LENGTH);
        }
        if (dep.status.toUpperCase() === 'DELAYED' && !dep.estimatedTime) {
             dest = 'DELAYED'.substring(0,7); // Show delayed status instead of dest
             plat = '  ';
        }

        // Combine, ensuring total length is DISPLAY_LENGTH
        let output = `${time} ${dest}${plat}`;
        return output.padEnd(DISPLAY_LENGTH).substring(0, DISPLAY_LENGTH);
    };

    // Placeholder function to simulate fetching data from the backend
    const fetchDepartures = async () => {
        if (!fromStation) {
            setError("Please enter a 'From' station CRS code.");
            setDepartures([]);
            return;
        }
        setIsLoading(true);
        setError(null);
        console.log(`Fetching departures from backend: from=${fromStation}, to=${toStation || 'any'}`);

        // Construct the API URL
        // Ensure the backend URL is configurable or uses environment variables in a real app
        const backendUrl = 'http://localhost:3001'; // Assuming backend runs on port 3001
        const apiUrl = new URL('/api/departures', backendUrl);
        apiUrl.searchParams.append('from', fromStation);
        if (toStation) {
            apiUrl.searchParams.append('to', toStation);
        }

        try {
            const response = await fetch(apiUrl.toString());

            if (!response.ok) {
                // Try to get error message from backend response body
                let errorData;
                try {
                    errorData = await response.json();
                } catch (jsonError) {
                    // Ignore if response is not JSON
                }
                const errorMessage = errorData?.error || `HTTP error! status: ${response.status}`;
                throw new Error(errorMessage);
            }

            const data: Departure[] = await response.json();
            setDepartures(data);

        } catch (err) {
            console.error("Failed to fetch departures:", err);
            setError(err instanceof Error ? err.message : "An unknown error occurred fetching data.");
            setDepartures([]); // Clear departures on error
        } finally {
            setIsLoading(false);
        }
    };

    // Function to send a specific departure line to the display
    const handleSendDeparture = (departure: Departure) => {
        if (!isConnected) return;
        const displayString = formatDepartureForDisplay(departure);
        onSendMessage(displayString);
    };


    return (
        <div className="train-timetable-mode">
            <h4 className="draggable-handle">Train Timetable</h4>
            <div className="station-inputs">
                <div>
                    <label htmlFor="fromStation">From (CRS): </label>
                    <input
                        type="text"
                        id="fromStation"
                        value={fromStation}
                        onChange={(e) => setFromStation(e.target.value.toUpperCase())}
                        placeholder="e.g., KGX"
                        maxLength={3}
                        disabled={!isConnected || isLoading}
                        className="crs-input"
                    />
                </div>
                <div>
                    <label htmlFor="toStation">To (CRS): </label>
                    <input
                        type="text"
                        id="toStation"
                        value={toStation}
                        onChange={(e) => setToStation(e.target.value.toUpperCase())}
                        placeholder="Optional (e.g., EDB)"
                        maxLength={3}
                        disabled={!isConnected || isLoading}
                        className="crs-input"
                    />
                </div>
                {/* Manual refresh button might still be useful */}
                <button onClick={fetchDepartures} disabled={!isConnected || isLoading || !fromStation}>
                    {isLoading ? 'Refreshing...' : 'Refresh Now'}
                </button>
            </div>

            {error && <p className="error-message">Error: {error}</p>}

            <div className="departures-list">
                <h5>Departures</h5>
                {isLoading && departures.length === 0 && <p>Loading departures...</p>}
                {!isLoading && !error && departures.length === 0 && fromStation && <p>No departures found for {fromStation}{toStation ? ` to ${toStation}` : ''}.</p>}
                {!isLoading && !error && departures.length === 0 && !fromStation && <p>Enter a 'From' station code and click Refresh.</p>}

                {departures.length > 0 && (
                    <table>
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Destination</th>
                                <th>Plat</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {departures.map((dep) => (
                                <tr key={dep.id}>
                                    <td>{dep.estimatedTime && dep.estimatedTime !== dep.scheduledTime ? <del>{dep.scheduledTime}</del> : dep.scheduledTime} {dep.estimatedTime && dep.estimatedTime !== dep.scheduledTime && dep.estimatedTime !== 'On time' ? <span>{dep.estimatedTime}</span> : ''}</td>
                                    <td>{dep.destination}</td>
                                    <td>{dep.platform || '-'}</td>
                                    <td>{dep.status}</td>
                                    <td>
                                        <button
                                            onClick={() => handleSendDeparture(dep)}
                                            disabled={!isConnected}
                                            title={`Send to display: ${formatDepartureForDisplay(dep)}`}
                                            className="send-button"
                                        >
                                            Send
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

             <p style={{fontSize: '0.8em', color: '#666', marginTop: '15px'}}>
                Note: This uses mock data from the backend service. The backend needs National Rail Enquiries integration for live data. Polling is active when mode is selected, connected, and 'From' station is set.
            </p>
        </div>
    );
};

export default TrainTimetableMode;
