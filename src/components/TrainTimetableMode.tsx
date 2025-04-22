import React, { useState, useEffect, useRef } from 'react'; // Import useRef
import { SPLITFLAP_DISPLAY_LENGTH } from '../constants'; // Use renamed constant
import './TrainTimetableMode.css';
import { Departure, TrainRoutePreset } from '../types'; // Import types
 
// Define the structure for departure data (as discussed)
// Removed local Departure interface
/*
interface Departure {
  id: string;
  scheduledTime: string;
  destination: string;
  platform?: string;
  status: string;
  estimatedTime?: string;
}
*/

// Define the props for the component
interface TrainTimetableModeProps {
    isConnected: boolean;
    // isActive removed
    onSendMessage: (message: string) => void; // For sending single lines
    onStartUpdates: (fromCRS: string, toCRS?: string) => void; // Callback to trigger backend polling
    departures: Departure[]; // Receive departures list from App state
}

const POLLING_INTERVAL_MS = 60000; // Poll every 60 seconds
const PRESET_STORAGE_KEY = 'trainTimetablePresets';

const TrainTimetableMode: React.FC<TrainTimetableModeProps> = ({ isConnected, onSendMessage, onStartUpdates, departures }) => { // Add onStartUpdates to destructuring
    const [fromStation, setFromStation] = useState<string>('TON'); // e.g., KGX
    const [toStation, setToStation] = useState<string>('');   // e.g., EDB (optional)
    // Removed internal departures state, now comes from props
    // const [departures, setDepartures] = useState<Departure[]>([]);
    const [selectedDepartureIds, setSelectedDepartureIds] = useState<Set<string>>(new Set()); // State for selected rows
    const [savedPresets, setSavedPresets] = useState<TrainRoutePreset[]>([]); // State for presets
    const [isLoading, setIsLoading] = useState<boolean>(false); // Keep loading state for manual refresh
    const [error, setError] = useState<string | null>(null);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null); // Ref for polling interval
    // Removed formattedDisplayStrings state

    console.log('[TrainTimetableMode] Rendering. isConnected:', isConnected); // <-- ADD LOG

    // Helper to get hour and minute from a departure time string (HH:MM)
    const getHourMinute = (timeString: string | undefined): { hour: number | null, minute: number | null } => {
        if (!timeString || !/^\d{2}:\d{2}$/.test(timeString)) {
            return { hour: null, minute: null };
        }
        const parts = timeString.split(':');
        return { hour: parseInt(parts[0], 10), minute: parseInt(parts[1], 10) };
    };

    // Load presets from localStorage on mount
    useEffect(() => {
        const storedPresets = localStorage.getItem(PRESET_STORAGE_KEY);
        if (storedPresets) {
            try {
                setSavedPresets(JSON.parse(storedPresets));
            } catch (e) {
                console.error("Failed to parse saved presets from localStorage", e);
                localStorage.removeItem(PRESET_STORAGE_KEY);
            }
        }
    }, []); // Empty dependency array ensures this runs only once on mount
 
    // Effect to handle polling for updates - REMOVED
    /*
    useEffect(() => {
        // Function to clear existing interval
        const clearPollingInterval = () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
                console.log('[Train Mode] Polling stopped.');
            }
        };

        // Start polling only if mode is active, connected, and a valid station is set
        if (isActive && isConnected && fromStation && fromStation.length === 3 && !isLoading) {
            console.log(`[Train Mode] Setting up polling for ${fromStation} every ${POLLING_INTERVAL_MS}ms`);
            // Clear previous interval before setting a new one
            clearPollingInterval();
            pollingIntervalRef.current = setInterval(() => {
                console.log(`[Train Mode] Polling for updates: ${fromStation}`);
                fetchDepartures(); // Fetch using current state
            }, POLLING_INTERVAL_MS);
        } else {
            clearPollingInterval(); // Stop polling if conditions aren't met
        }

        // Cleanup function to clear interval on unmount or when dependencies change
        return clearPollingInterval;
    }, [isActive, isConnected, fromStation, toStation, isLoading]); // Dependencies for polling effect
    */
 
    // Placeholder function to simulate fetching data from the backend - REMOVED
    /*
    const fetchDepartures = async () => {
        // Use component state directly
        if (!fromStation || fromStation.length !== 3) {
            setError("Please enter a 'From' station CRS code.");
            // setDepartures([]); // Don't clear departures here, let the error display
            return;
        }
        // Removed state updates from here, handled by inputs/presets

        setIsLoading(true);
        setError(null); // Clear previous errors before fetching
        console.log(`Fetching departures from backend: from=${fromStation}, to=${toStation || 'any'}`);
        // --- Add Log ---
        // Log the state values *just before* the fetch call
        console.log(`[fetchDepartures] Making API call with From=${fromStation}, To=${toStation || undefined}`);

        // Construct the API URL
        const backendUrl = 'http://localhost:3001'; // Assuming backend runs on port 3001
        const apiUrl = new URL('/api/departures', backendUrl);
        apiUrl.searchParams.append('from', fromStation); // Use state variable
        if (toStation) { // Use state variable 'toStation' here
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
    */

    // Function to send a specific departure line to the display
    // Calculates the condensed format on demand
    const handleSendDeparture = (index: number) => {
        console.log(`[TrainTimetableMode] handleSendDeparture called for index: ${index}`); // <-- ADD LOG
        if (!isConnected || index < 0 || index >= departures.length) {
            console.log(`[TrainTimetableMode] handleSendDeparture aborted. isConnected: ${isConnected}, index: ${index}, departures length: ${departures.length}`); // <-- ADD LOG for abort reason
            return;
        }

        const dep = departures[index];
        const prevDep = index > 0 ? departures[index - 1] : null;

        // Determine the time to display and its hour/minute
        const displayTimeStr = (dep.estimatedTime && dep.estimatedTime !== 'On time' && dep.estimatedTime !== 'Delayed' && dep.estimatedTime !== 'Cancelled')
            ? dep.estimatedTime
            : dep.scheduledTime;
        const { hour: currentHour, minute: currentMinute } = getHourMinute(displayTimeStr);

        // Determine previous hour for comparison, considering its status
        const prevDisplayTimeStr = prevDep ? ((prevDep.estimatedTime && prevDep.estimatedTime !== 'On time' && prevDep.estimatedTime !== 'Delayed' && prevDep.estimatedTime !== 'Cancelled') ? prevDep.estimatedTime : prevDep.scheduledTime) : null;
        const { hour: previousHour } = prevDisplayTimeStr ? getHourMinute(prevDisplayTimeStr) : { hour: null };
        const prevWasSpecialStatus = prevDep && (prevDep.status.toUpperCase() === 'CANCELLED' || (prevDep.status.toUpperCase() === 'DELAYED' && !prevDep.estimatedTime));


        let timePart: string;

        if (dep.status.toUpperCase() === 'CANCELLED') {
            timePart = 'CANC';
        } else if (dep.status.toUpperCase() === 'DELAYED' && !dep.estimatedTime) {
             timePart = 'DLAY';
        } else if (currentHour !== null && currentMinute !== null) {
            const minuteStr = currentMinute.toString().padStart(2, '0'); // MM
            // Only use '  MM' if hours match AND previous train wasn't cancelled/delayed without estimate
            if (currentHour === previousHour && !prevWasSpecialStatus) {
                timePart = `  ${minuteStr}`; // Hour is same, show space-space-minute-minute
            } else {
                timePart = currentHour.toString().padStart(2, '0') + minuteStr; // Hour is different or prev was special, show hour-hour-minute-minute
            }
        } else {
            timePart = '----'; // Fallback
        }

        // Format the rest of the string (same logic as before)
        const plat = dep.platform ? dep.platform.slice(-1) : ' ';
        const maxDestLength = 7; // Space + Dest + Plat = 8 chars. Time = 4 chars. Total 12.
        let dest = dep.destination.toUpperCase().substring(0, maxDestLength - plat.length); // Max 6 chars for dest if platform exists
        dest = dest.padEnd(maxDestLength - plat.length); // Pad destination to fill space (6 or 7 chars)

        let output: string;
        if (timePart === 'CANC') {
            output = 'CANCELLED   '; // Specific 12-char format
        } else if (timePart === 'DLAY') {
            output = 'DELAYED     '; // Specific 12-char format
        } else {
            // The output string uses the calculated timePart (HHMM or   MM), not the full estimatedTime string
            output = `${timePart} ${dest}${plat}`; // TTTT + space + DEST(6/7) + P(1/0) = 12
        }

        // Send the condensed 12-character string to the backend/display
        onSendMessage(output.padEnd(SPLITFLAP_DISPLAY_LENGTH).substring(0, SPLITFLAP_DISPLAY_LENGTH));
    };

    // --- Preset Handlers ---
    const handleSavePreset = () => {
        console.log('[TrainTimetableMode] handleSavePreset called.'); // <-- ADD LOG
        if (!fromStation || fromStation.length !== 3) {
            alert("Please enter a valid 3-letter 'From' station code first.");
            return;
        }
        const presetName = prompt("Enter a name for this route preset:", `${fromStation}${toStation ? ` to ${toStation}` : ''}`);
        if (!presetName || presetName.trim() === '') return;

        const newPreset: TrainRoutePreset = {
            name: presetName.trim(),
            fromCRS: fromStation,
            toCRS: toStation || undefined, // Store empty string as undefined
        };

        // Avoid duplicate names (simple check)
        if (savedPresets.some(p => p.name === newPreset.name)) {
            if (!confirm(`A preset named "${newPreset.name}" already exists. Overwrite it?`)) {
                return;
            }
        }

        const updatedPresets = [...savedPresets.filter(p => p.name !== newPreset.name), newPreset];
        updatedPresets.sort((a, b) => a.name.localeCompare(b.name)); // Keep sorted
        setSavedPresets(updatedPresets);
        localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(updatedPresets));
        alert(`Preset "${newPreset.name}" saved!`);
    };

    const handleSelectPreset = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedName = event.target.value;
        const selectedPreset = savedPresets.find(p => p.name === selectedName);
        if (selectedPreset) {
            // ONLY update the state fields, do not fetch automatically
            setFromStation(selectedPreset.fromCRS);
            setToStation(selectedPreset.toCRS || ''); // Update local state
            // Trigger backend update for the new route
            onStartUpdates(selectedPreset.fromCRS, selectedPreset.toCRS);
            setError(null); // Clear previous errors
        } else {
            // Clear inputs and results if "-- Select Preset --" is chosen
            setFromStation(''); // Clear local state
            setToStation('');
            // setDepartures([]); // Data now comes from props
            setError(null);
        }
    };

    const handleDeletePreset = () => {
        console.log('[TrainTimetableMode] handleDeletePreset called.'); // <-- ADD LOG
        const selectElement = document.getElementById('presetSelector') as HTMLSelectElement;
        const selectedName = selectElement?.value;
        if (!selectedName || !savedPresets.some(p => p.name === selectedName)) {
            alert("Please select a preset from the list to delete.");
            return;
        }

        if (confirm(`Are you sure you want to delete the preset "${selectedName}"?`)) {
            const updatedPresets = savedPresets.filter(p => p.name !== selectedName);
            setSavedPresets(updatedPresets);
            localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(updatedPresets));
            alert(`Preset "${selectedName}" deleted.`);
            // Optionally clear inputs if the deleted preset was loaded
            const deletedPreset = savedPresets.find(p => p.name === selectedName); // Find *before* filtering state
            if (deletedPreset && fromStation === deletedPreset.fromCRS && toStation === (deletedPreset.toCRS || '')) {
                setFromStation('');
                setToStation(''); // Clear local state
                // setDepartures([]); // Data now comes from props
            }
        }
    };
    // --- End Preset Handlers ---

    // --- Input Change Handlers ---
    const handleFromStationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFromStation(e.target.value.toUpperCase());
        setError(null); // Clear error on input change
    };

    const handleToStationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setToStation(e.target.value.toUpperCase());
        setError(null); // Clear error on input change
    };
    // --- End Input Change Handlers ---

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
                       onChange={handleFromStationChange} // Use new handler
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
                       onChange={handleToStationChange} // Use new handler
                       placeholder="Optional (e.g., EDB)"
                       maxLength={3}
                        disabled={!isConnected || isLoading}
                        className="crs-input"
                    />
               </div>
               {/* Manual refresh button now explicitly uses state */}
               <button
                    onClick={() => {
                        console.log('[TrainTimetableMode] Refresh Now button clicked.'); // <-- ADD LOG
                        onStartUpdates(fromStation, toStation);
                    }}
                    // Re-added isLoading check which might have been accidentally removed
                    disabled={!isConnected || !fromStation || fromStation.length !== 3 || isLoading}
                >
                    {isLoading ? 'Refreshing...' : 'Refresh Now'}
                </button>
            </div>

            {/* Preset Management */}
            <div className="preset-management">
                <select id="presetSelector" onChange={handleSelectPreset} disabled={isLoading}>
                    <option value="">-- Select Preset --</option>
                    {savedPresets.map(preset => (
                        <option key={preset.name} value={preset.name}>{preset.name}</option>
                    ))}
                </select>
                <button onClick={handleSavePreset} disabled={!isConnected || !fromStation || fromStation.length !== 3 || isLoading} title="Save current From/To as a preset">
                    💾 Save Preset
                </button>
                <button onClick={handleDeletePreset} disabled={!isConnected || isLoading} title="Delete selected preset">
                    🗑️ Delete Preset
                </button>
            </div>

            {error && <p className="error-message">Error: {error}</p>}

            <div className="departures-list">
                <h5>Departures</h5>
                {isLoading && <p>Loading departures...</p>}
                {!isLoading && !error && departures.length === 0 && fromStation && <p>No departures found for {fromStation}{toStation ? ` to ${toStation}` : ''}.</p>}
                {!isLoading && !error && departures.length === 0 && !fromStation && <p>Enter a 'From' station code and click Refresh.</p>}
 
                {departures.length > 0 && (
                    <table>
                       <thead>
                           <tr>
                               {/* Removed Select column */}
                               <th>Time</th>
                               <th>Destination</th>
                               <th>Plat</th>
                               <th>Status</th>
                               <th>ETA (Dest)</th>{/* Add new header */}
                               <th>Action</th>
                           </tr>
                       </thead>
                        <tbody>
                            {departures.map((dep, index) => ( // Add index here
                                <tr key={dep.id}>
                                    {/* Removed Checkbox cell */}
                                    {/* This logic displays STD crossed out and ETD if available and different */}
                                    <td className="time-cell"> {/* Add class for potential styling */}
                                        {/* Show scheduled time, cross out if estimate exists and differs */}
                                        {dep.estimatedTime && dep.estimatedTime !== dep.scheduledTime
                                            ? <del>{dep.scheduledTime}</del>
                                            : dep.scheduledTime
                                        }
                                        {' '}
                                        {/* Show estimated time if it exists and differs from scheduled */}
                                        {dep.estimatedTime && dep.estimatedTime !== dep.scheduledTime
                                            ? <span>{dep.estimatedTime}</span>
                                            : ''
                                        }
                                    </td>
                                    <td>{dep.destination}</td>
                                    <td>{dep.platform || '-'}</td>
                                    <td>{dep.status}</td>
                                    {/* Add cell for Destination ETA */}
                                    <td>{dep.destinationETA || '-'}</td>
                                    <td>
                                        <button // Use index to send correct formatted string
                                            onClick={() => handleSendDeparture(index)}
                                            disabled={!isConnected}
                                            title={`Send departure info to display`} // Simplified title
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
                Note: Fetches live data via backend. Auto-refreshes when route is active.
            </p>
        </div>
    );
};

export default TrainTimetableMode;
