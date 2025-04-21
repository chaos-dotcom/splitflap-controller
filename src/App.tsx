import { useState, useEffect, KeyboardEvent } from 'react'; // Import useEffect, KeyboardEvent
import './App.css';
import SplitFlapDisplay from './components/SplitFlapDisplay';
// Removed SettingsPanel import
import TrainTimetableMode from './components/TrainTimetableMode'; // Import placeholder
import SequenceMode from './components/SequenceMode'; // Import SequenceMode
import ClockMode from './components/ClockMode'; // Import ClockMode
import StopwatchMode from './components/StopwatchMode'; // Import StopwatchMode
import { DISPLAY_LENGTH, ALLOWED_CHARS } from './constants'; // Import ALLOWED_CHARS
// Removed mqttService import
import { socketService } from './services/socketService'; // Import Socket.IO service
import { ControlMode, Scene } from './types'; // Import types (MqttSettings no longer needed here)

function App() {
  // --- State for Frontend ---
  const [displayText, setDisplayText] = useState<string>(' '.repeat(DISPLAY_LENGTH)); // What the display *should* show
  const [draftText, setDraftText] = useState<string>(' '.repeat(DISPLAY_LENGTH)); // State for inline editing in text mode
  // --- State related to Backend ---
  const [isConnectedToBackend, setIsConnectedToBackend] = useState<boolean>(false); // Added
  const [backendError, setBackendError] = useState<string | null>(null); // Added (Placeholder for future use)
  const [displayMqttStatus, setDisplayMqttStatus] = useState<{ status: string; error: string | null }>({ status: 'disconnected', error: null }); // Added (Placeholder for future use)
  const [stopwatchIsRunningBackend, setStopwatchIsRunningBackend] = useState<boolean>(false); // Added
  // --- End Backend State ---
  const [caretPosition, setCaretPosition] = useState<number>(0); // State for cursor position in text mode
  const [currentMode, setCurrentMode] = useState<ControlMode>('text'); // State for current control mode


  // Update draft text when display text changes (e.g., from backend or initial load)
  useEffect(() => {
    setDraftText(displayText);
    // Optionally reset caret, or try to maintain position if practical
    // setCaretPosition(0); // Reset caret when display updates externally for simplicity
  }, [displayText]);

  // --- Socket.IO Connection Effect ---
  useEffect(() => {
    socketService.connect(
      // onInitialState
      (state) => {
        console.log('[App] Received initial state:', state);
        setDisplayText(state.text);
        setCurrentMode(state.mode);
        setStopwatchIsRunningBackend(state.stopwatch?.isRunning ?? false); // Handle potential missing stopwatch state
        // TODO: Add sequence state if needed
      },
      // onDisplayUpdate
      (data) => setDisplayText(data.text),
      // onModeUpdate
      (data) => {
        console.log(`[App] Received modeUpdate from backend: ${data.mode}`); // <-- ADD THIS LOG
        setCurrentMode(data.mode);
      },
      // onMqttStatus
      (status) => setDisplayMqttStatus(status),
      // onStopwatchUpdate
      (data) => { setStopwatchIsRunningBackend(data.isRunning); /* Display updated via displayUpdate */ },
      // onSequenceStopped
      () => { /* Handle sequence stopped if needed */ console.log('Sequence Stopped'); },
      // onConnect
      () => {
        setIsConnectedToBackend(true);
        setBackendError(null);
        socketService.emitGetMqttStatus(); // Ask for MQTT status on connect
      },
      // onDisconnect
      (reason) => {
        setIsConnectedToBackend(false);
        setBackendError(`Disconnected: ${reason}`);
        setDisplayMqttStatus({ status: 'unknown', error: null }); // Reset MQTT status
      },
      // onError
      (message) => {
        setIsConnectedToBackend(false); // Assume disconnect on error
        setBackendError(message);
      }
    );

    // Cleanup on unmount
    return () => {
      socketService.disconnect();
    };
  }, []); // Empty dependency array ensures this runs only once on mount


  // --- Handlers for Interactive Display ---
  const handleDisplayKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Only handle keys if in text mode and connected
    if (currentMode !== 'text' || !isConnectedToBackend) return;

    // Allow basic navigation/selection even if we don't handle the key
    // event.preventDefault(); // Prevent default browser actions ONLY for keys we explicitly handle

    const key = event.key;
    let newDraft = draftText.split('');
    let newCaretPos = caretPosition;
    let handled = false; // Flag to track if we processed the key

    if (key === 'Enter') {
      // Send text via WebSocket
      socketService.emitSetText(draftText);
      handled = true;
    } else if (key === 'Backspace') {
      if (newCaretPos > 0) {
        newDraft[newCaretPos - 1] = ' '; // Replace char before caret with space
        newCaretPos--;
        handled = true;
      }
    } else if (key === 'Delete') {
       if (newCaretPos < DISPLAY_LENGTH) {
           newDraft[newCaretPos] = ' '; // Replace char at caret with space
           // Caret position doesn't move on delete
           handled = true;
       }
    } else if (key === 'ArrowLeft') {
      if (newCaretPos > 0) {
          newCaretPos--;
          handled = true;
      }
    } else if (key === 'ArrowRight') {
      // Allow moving caret up to the position *after* the last character
      if (newCaretPos < DISPLAY_LENGTH) {
          newCaretPos++;
          handled = true;
      }
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) { // Handle character input, ignore modifiers
      let charToInsert: string | null = null;

      // Check if the exact key pressed is allowed (covers lowercase colors, uppercase letters, numbers, symbols)
      if (ALLOWED_CHARS.includes(key)) {
          charToInsert = key;
      }
      // If not, check if the uppercase version is allowed (handles typing 'a' -> 'A')
      else if (ALLOWED_CHARS.includes(key.toUpperCase())) {
          charToInsert = key.toUpperCase();
      }

      // If we determined a valid character to insert and there's space
      if (charToInsert !== null && newCaretPos < DISPLAY_LENGTH) {
         newDraft[newCaretPos] = charToInsert;
         if (newCaretPos < DISPLAY_LENGTH) { // Move caret forward after typing if not at the very end
           newCaretPos++;
         }
         handled = true;
      }
    }

    if (handled) {
        event.preventDefault(); // Prevent default action only if we handled the key
        setDraftText(newDraft.join(''));
        setCaretPosition(newCaretPos);
    }
  };

 // Basic click handler to set caret position (can be improved)
 const handleDisplayClick = (event: React.MouseEvent<HTMLDivElement>) => {
     // Only handle clicks if in text mode and connected
     if (currentMode !== 'text' || !isConnectedToBackend) return;
      // Very basic: try to guess character index based on click position
      // This needs refinement for accuracy based on actual element positions/widths
      const displayRect = event.currentTarget.getBoundingClientRect();
      const clickX = event.clientX - displayRect.left;
      const approxCharWidth = displayRect.width / DISPLAY_LENGTH;
      const clickedIndex = Math.floor(clickX / approxCharWidth);
      setCaretPosition(Math.max(0, Math.min(DISPLAY_LENGTH, clickedIndex))); // Clamp index
      event.currentTarget.focus(); // Ensure display gets focus on click
  };

  // --- Placeholder Emitters (to be connected to socketService) ---
  // Wrapper for modes that just send a single text message (like Train Timetable 'Send' button)
  const handleSendText = (text: string) => {
      socketService.emitSetText(text);
  };

  // Stopwatch Emitters
  const handleStartStopwatch = () => {
      socketService.emitStartStopwatch();
  };
  const handleStopStopwatch = () => {
      socketService.emitStopStopwatch();
  };
  const handleResetStopwatch = () => {
      socketService.emitResetStopwatch();
  };

  // Sequence Emitters
  const handlePlaySequence = (scene: Scene) => { // Use correct Scene type
      socketService.emitPlaySequence(scene);
  };
  const handleStopSequence = () => {
      socketService.emitStopSequence();
  };
  // --- End Placeholder Emitters ---

  // --- Mode Change Handler ---
  const handleSetMode = (mode: ControlMode) => {
      if (isConnectedToBackend) {
          socketService.emitSetMode(mode);
          // Note: The actual state update (setCurrentMode) happens
          // when the backend confirms via the 'modeUpdate' event.
      } else {
          console.warn("Cannot change mode: Disconnected from backend.");
          // Optionally provide user feedback here
      }
  };
  // --- End Mode Change Handler ---


  return (
    <div className="app-container">
      <h1>Split-Flap Controller</h1>

      {/* Removed Settings Panel and connection error display */}


      {/* Split Flap Display - Now Interactive */}
      <SplitFlapDisplay
        // Show draft text only when in text mode, otherwise show last published text
        text={currentMode === 'text' ? draftText : displayText}
        caretPosition={caretPosition} // Caret position is only relevant in text mode
        onKeyDown={handleDisplayKeyDown} // Handler checks for mode internally
        isConnected={isConnectedToBackend} // Pass backend connection status
        onClick={handleDisplayClick} // Handler checks for mode internally
        isInteractive={currentMode === 'text'} // Explicitly pass if display should be interactive
      />

      {/* Mode Selector */}
      <div className="mode-selector">
          {/* Use handleSetMode to request change via backend */}
          <button onClick={() => handleSetMode('text')} disabled={currentMode === 'text'}>Text Input</button>
          <button onClick={() => handleSetMode('train')} disabled={currentMode === 'train'}>Train Times</button>
          <button onClick={() => handleSetMode('sequence')} disabled={currentMode === 'sequence'}>Sequence</button>
          <button onClick={() => handleSetMode('clock')} disabled={currentMode === 'clock'}>Clock</button>
          <button onClick={() => handleSetMode('stopwatch')} disabled={currentMode === 'stopwatch'}>Stopwatch</button>
      </div>

      {/* Mode Specific Controls */}
      <div className="mode-controls">
          {/* Temporarily render directly without Draggable */}
          {currentMode === 'train' && (
              <TrainTimetableMode isConnected={isConnectedToBackend} onSendMessage={handleSendText} onPlayScene={handlePlaySequence} />
          )}
          {currentMode === 'sequence' && (
             <SequenceMode
                isConnected={isConnectedToBackend}
                onPlay={handlePlaySequence}
                onStop={handleStopSequence}
             />
          )}
          {currentMode === 'clock' && (
             <ClockMode isConnectedToBackend={isConnectedToBackend} />
          )}
          {currentMode === 'stopwatch' && (
             <StopwatchMode
                isConnectedToBackend={isConnectedToBackend}
                displayTime={displayText} // Pass the main display text
                isRunningBackend={stopwatchIsRunningBackend} // Pass backend running state
                onStart={handleStartStopwatch}
                onStop={handleStopStopwatch}
                onReset={handleResetStopwatch}
             />
          )}
          {/* Add other mode components here later */}
      </div>

      {/* Removed conditional paragraph checking !isConnected */}

    </div>
  );
}

export default App;
