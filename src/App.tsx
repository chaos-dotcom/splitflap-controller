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
import { ControlMode } from './types'; // Import types (MqttSettings no longer needed here)
// Removed Buffer polyfill

function App() {
  // --- State for Frontend ---
  const [displayText, setDisplayText] = useState<string>(' '.repeat(DISPLAY_LENGTH)); // What the display *should* show
  const [draftText, setDraftText] = useState<string>(' '.repeat(DISPLAY_LENGTH)); // State for inline editing in text mode
  const [caretPosition, setCaretPosition] = useState<number>(0); // State for cursor position in text mode
  const [currentMode, setCurrentMode] = useState<ControlMode>('text'); // State for current control mode

  // Update draft text when display text changes (e.g., from MQTT message or initial load)
  useEffect(() => {
    setDraftText(displayText);
    // Optionally reset caret, or try to maintain position if practical
    // setCaretPosition(0); // Reset caret when display updates externally for simplicity
  }, [displayText]);


  // --- Placeholder for Backend Communication ---
  // This function will eventually emit a WebSocket event
  const publishMessage = (message: string) => {
    // if (!isConnectedToBackend) return; // Check backend connection later

    // Ensure message is correct length before publishing
    const formattedMessage = message.padEnd(DISPLAY_LENGTH).substring(0, DISPLAY_LENGTH);
    console.log(`Publishing message to backend: ${formattedMessage}`); // Log intent
    setDisplayText(formattedMessage); // Update the "official" display state locally
    // TODO: Replace with socketService.emit('setText', { text: formattedMessage });
    // Consider resetting caret after sending, or leave it
    // setCaretPosition(0);
  };


  // --- Handlers for Interactive Display ---
  const handleDisplayKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Only handle keys if in text mode (connection check will be done before sending)
    if (currentMode !== 'text') return;

    // Allow basic navigation/selection even if we don't handle the key
    // event.preventDefault(); // Prevent default browser actions ONLY for keys we explicitly handle

    const key = event.key;
    let newDraft = draftText.split('');
    let newCaretPos = caretPosition;
    let handled = false; // Flag to track if we processed the key

    if (key === 'Enter') {
      publishMessage(draftText); // Send the current draft text
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
      // Only handle clicks if in text mode (connection check not needed for local caret update)
      if (currentMode !== 'text') return;
      // Very basic: try to guess character index based on click position
      // This needs refinement for accuracy based on actual element positions/widths
      const displayRect = event.currentTarget.getBoundingClientRect();
      const clickX = event.clientX - displayRect.left;
      const approxCharWidth = displayRect.width / DISPLAY_LENGTH;
      const clickedIndex = Math.floor(clickX / approxCharWidth);
      setCaretPosition(Math.max(0, Math.min(DISPLAY_LENGTH, clickedIndex))); // Clamp index
      event.currentTarget.focus(); // Ensure display gets focus on click
  };


  return (
    <div className="app-container">
      <h1>Split-Flap Controller</h1>

      {/* Removed Settings Panel and connection error display */}


      {/* Split Flap Display - Now Interactive */}
      <SplitFlapDisplay // Removed isConnected prop
        // Show draft text only when in text mode, otherwise show last published text
        text={currentMode === 'text' ? draftText : displayText}
        caretPosition={caretPosition} // Caret position is only relevant in text mode
        onKeyDown={handleDisplayKeyDown} // Handler checks for mode internally
        // isConnected prop removed
        onClick={handleDisplayClick} // Handler checks for mode internally
        isInteractive={currentMode === 'text'} // Explicitly pass if display should be interactive
      />

      {/* Mode Selector */}
      <div className="mode-selector">
          <button onClick={() => setCurrentMode('text')} disabled={currentMode === 'text'}>Text Input Mode</button>
          <button onClick={() => setCurrentMode('train')} disabled={currentMode === 'train'}>Train Timetable Mode</button>
          <button onClick={() => setCurrentMode('sequence')} disabled={currentMode === 'sequence'}>Sequence Mode</button>
          <button onClick={() => setCurrentMode('clock')} disabled={currentMode === 'clock'}>Clock Mode</button>
          <button onClick={() => setCurrentMode('stopwatch')} disabled={currentMode === 'stopwatch'}>Stopwatch Mode</button>
      </div>

      {/* Mode Specific Controls */}
      <div className="mode-controls">
          {currentMode === 'train' && ( // Removed isConnected prop
              <TrainTimetableMode onSendMessage={publishMessage} />
          )}
          {/* Add the conditional rendering for SequenceMode */}
          {currentMode === 'sequence' && ( // Removed isConnected prop
             <SequenceMode onSendMessage={publishMessage} />
          )}
          {currentMode === 'clock' && ( // Removed isConnected and isActive props
             <ClockMode onSendMessage={publishMessage} />
          )}
          {currentMode === 'stopwatch' && ( // Removed isConnected and isActive props
             <StopwatchMode onSendMessage={publishMessage} />
          )}
          {/* Add other mode components here later */}
      </div>

      {/* Removed conditional paragraph checking !isConnected */}

    </div>
  );
}

export default App;
