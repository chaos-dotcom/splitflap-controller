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
    const [formattedDisplayStrings, setFormattedDisplayStrings] = useState<string[]>([]); // State for formatted strings

    // Helper to get hour and minute from a departure time string (HH:MM)
    const getHourMinute = (timeString: string | undefined): { hour: number | null, minute: number | null } => {
        if (!timeString || !/^\d{2}:\d{2}$/.test(timeString)) {
            return { hour: null, minute: null };
        }
        const parts = timeString.split(':');
        return { hour: parseInt(parts[0], 10), minute: parseInt(parts[1], 10) };
    };

    // Effect to calculate formatted display strings whenever departures change
    useEffect(() => {
        let previousHour: number | null = null;
        const newFormattedStrings = departures.map(dep => {
            // Determine the time to display and its hour/minute
            const displayTimeStr = (dep.estimatedTime && dep.estimatedTime !== 'On time' && dep.estimatedTime !== 'Delayed' && dep.estimatedTime !== 'Cancelled')
                ? dep.estimatedTime
                : dep.scheduledTime;
            const { hour: currentHour, minute: currentMinute } = getHourMinute(displayTimeStr);

            let timePart: string;

            if (dep.status.toUpperCase() === 'CANCELLED') {
                timePart = 'CANC'.padEnd(4); // Use first 4 chars for time slot (Adjusted from CANCELLED)
                previousHour = null; // Reset hour context after cancelled
            } else if (dep.status.toUpperCase() === 'DELAYED' && !dep.estimatedTime) {
                 timePart = 'DLAY'; // Use first 4 chars for time slot
                 previousHour = null; // Reset hour context after delayed
            } else if (currentHour !== null && currentMinute !== null) {
                const minuteStr = currentMinute.toString().padStart(2, '0');
                if (currentHour === previousHour) {
                    timePart = `  ${minuteStr}`; // Hour is same, show space-space-minute-minute
                } else {
                    timePart = currentHour.toString().padStart(2, '0') + minuteStr; // Hour is different, show hour-hour-minute-minute
                    previousHour = currentHour; // Update previous hour
                }
            } else {
                timePart = '----'; // Fallback if time is invalid
                previousHour = null; // Reset hour context
            }

            // Combine with destination/platform (reuse existing logic, adapt if needed)
            // Format: TTTT DEST... P (4 + 1 space + 7 = 12)
            let dest = dep.destination.toUpperCase().substring(0, 7); // Max 7 chars for dest
            let plat = dep.platform ? `${dep.platform.padStart(1)}` : ' '; // Ensure 1 char for plat (space or num) - Adjusted for new time format
            // Ensure destination doesn't overwrite platform if too long
            dest = dest.padEnd(7 - plat.length); // Pad dest to fill remaining space before platform

            let output = `${timePart} ${dest}${plat}`;
            return output.padEnd(DISPLAY_LENGTH).substring(0, DISPLAY_LENGTH);
        });
        setFormattedDisplayStrings(newFormattedStrings);
    }, [departures]); // Recalculate when departures data changes

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
    // Now uses the pre-formatted string based on index
    const handleSendDeparture = (index: number) => {
        if (!isConnected || index < 0 || index >= formattedDisplayStrings.length) return;
        onSendMessage(formattedDisplayStrings[index]); // Send pre-formatted string
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
                            {departures.map((dep, index) => ( // Add index here
                                <tr key={dep.id}>
                                    <td>{dep.estimatedTime && dep.estimatedTime !== dep.scheduledTime ? <del>{dep.scheduledTime}</del> : dep.scheduledTime} {dep.estimatedTime && dep.estimatedTime !== dep.scheduledTime && dep.estimatedTime !== 'On time' ? <span>{dep.estimatedTime}</span> : ''}</td>
                                    <td>{dep.destination}</td>
                                    <td>{dep.platform || '-'}</td>
                                    <td>{dep.status}</td>
                                    <td>
                                        <button // Use index to send correct formatted string
                                            onClick={() => handleSendDeparture(index)}
                                            disabled={!isConnected}
                                            title={`Send to display: ${formattedDisplayStrings[index] || ''}`} // Use pre-formatted string in title
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

             <p style={{fontSize: '0.8em', color: 'var(--tt-info-text, #666)', marginTop: '15px'}}>
                Note: This uses mock data from the backend service. The backend needs National Rail Enquiries integration for live data. Click 'Refresh Now' to fetch data.
            </p>
        </div>
    );
};

export default TrainTimetableMode;
