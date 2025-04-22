import { useState, useEffect, KeyboardEvent } from 'react'; // Import useEffect, KeyboardEvent
import './App.css';
import SplitFlapDisplay from './components/SplitFlapDisplay';
// Removed SettingsPanel import
import TrainTimetableMode from './components/TrainTimetableMode'; // Import placeholder
import SequenceMode from './components/SequenceMode'; // Import SequenceMode
import ClockMode from './components/ClockMode';
import StopwatchMode from './components/StopwatchMode';
import TimerMode from './components/TimerMode'; // <-- IMPORT TimerMode
import { SPLITFLAP_DISPLAY_LENGTH, ALLOWED_CHARS } from './constants';
import { socketService } from './services/socketService';
import { ControlMode, Scene, Departure } from './types';


function App() {
  // --- State for Frontend ---
  const [displayText, setDisplayText] = useState<string>(' '.repeat(SPLITFLAP_DISPLAY_LENGTH)); // What the display *should* show
  const [draftText, setDraftText] = useState<string>(' '.repeat(SPLITFLAP_DISPLAY_LENGTH)); // State for inline editing in text mode
  // --- State related to Backend Connection & Status ---
  const [isConnectedToBackend, setIsConnectedToBackend] = useState<boolean>(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [displayMqttStatus, setDisplayMqttStatus] = useState<{ status: string; error: string | null }>({ status: 'disconnected', error: null });
  const [stopwatchIsRunningBackend, setStopwatchIsRunningBackend] = useState<boolean>(false); // Added
  // --- Timer State ---
  const [timerIsRunningBackend, setTimerIsRunningBackend] = useState<boolean>(false); // <-- ADD
  const [timerRemainingMs, setTimerRemainingMs] = useState<number>(0); // <-- ADD
  const [timerTargetMs, setTimerTargetMs] = useState<number>(0); // <-- ADD (Initial duration set)
  // --- End Timer State ---
  // Add state for train departures list
  const [currentDepartures, setCurrentDepartures] = useState<Departure[]>([]);
  // --- End Backend State ---
  const [caretPosition, setCaretPosition] = useState<number>(0); // State for cursor position in text mode
  const [currentMode, setCurrentMode] = useState<ControlMode>('text'); // State for current control mode


  // Update draft text when display text changes (e.g., from backend or initial load)
  useEffect(() => {
    setDraftText(displayText.padEnd(SPLITFLAP_DISPLAY_LENGTH)); // Ensure draft matches length
    // Optionally reset caret, or try to maintain position if practical
    // setCaretPosition(0); // Reset caret when display updates externally for simplicity
  }, [displayText]);

  // --- Socket.IO Connection Effect ---
  useEffect(() => {
    console.log('[App] useEffect: Calling socketService.connect...'); // Add log before connect
    socketService.connect(
      // onInitialState (UNCOMMENT BODY and add timer handling)
      (state) => {
        // --- START UNCOMMENTING ---
        console.log('[App] Received initial state:', state);
        try {
          console.log('[App] Setting displayText...');
          setDisplayText(state.text);
          console.log('[App] Setting currentMode...');
          setCurrentMode(state.mode); // Set initial mode

          // Stopwatch State
          console.log('[App] Setting stopwatch state...');
          setStopwatchIsRunningBackend(state.stopwatch?.isRunning ?? false);
          // Note: Initial stopwatch display text comes from state.text if mode is stopwatch

          // Sequence State
          console.log('[App] Setting sequence state...');
          // setIsSequencePlayingBackend(state.sequence?.isPlaying ?? false); // Add if needed

          // Train State
          console.log('[App] Processing train state...');
          if (state.train) {
            console.log('[App] Setting currentDepartures:', state.train.departures);
            setCurrentDepartures(state.train.departures || []);
            // Optionally set from/to station based on state.train.route if needed for UI consistency
            // setFromStationInput(state.train.route?.fromCRS || '');
            // setToStationInput(state.train.route?.toCRS || '');
            console.log('[App] Train state processed.');
          } else {
            console.log('[App] No train state received in initial state.');
            setCurrentDepartures([]);
          }

          // Timer State <-- ADD THIS BLOCK
          console.log('[App] Setting timer state...');
          if (state.timer) {
              setTimerIsRunningBackend(state.timer.isRunning ?? false);
              setTimerRemainingMs(state.timer.remainingMs ?? 0);
              setTimerTargetMs(state.timer.targetMs ?? 0);
              console.log('[App] Timer state processed:', state.timer);
          } else {
              console.log('[App] No timer state received in initial state.');
              setTimerIsRunningBackend(false);
              setTimerRemainingMs(0);
              setTimerTargetMs(0);
          }
          // --- END TIMER BLOCK ---

          console.log('[App] Initial state processing complete.');
        } catch (error) {
          console.error('[App] Error processing initial state:', error);
          setBackendError('Error processing initial state from backend.');
        }
        // --- END UNCOMMENTING ---
      },
      // onDisplayUpdate (Restore original logic)
      (data) => setDisplayText(data.text), // <-- RESTORE
      // onModeUpdate (Restore original logic)
      (data) => {
        console.log(`[App] Received modeUpdate event from backend with mode: ${data.mode}`); // <-- ADD LOG
        setCurrentMode(data.mode);
      },
      // onMqttStatus (Restore original logic)
      (status) => setDisplayMqttStatus(status), // <-- RESTORE
      // onStopwatchUpdate (Restore original logic)
      (data) => { // <-- RESTORE BLOCK
          setStopwatchIsRunningBackend(data.isRunning);
          // Display is updated via displayUpdate, but we could force it here if needed
          // setDisplayText(formatStopwatchTime(data.elapsedTime)); // Requires formatStopwatchTime here
      }, // <-- RESTORE BLOCK
      // onTimerUpdate (UPDATE to set timer state)
      (data) => { // <-- UPDATE BLOCK
          console.log('[App] Received timerUpdate', data);
          setTimerIsRunningBackend(data.isRunning);
          setTimerRemainingMs(data.remainingMs);
          setTimerTargetMs(data.targetMs);
          // Display is updated via displayUpdate from backend
      }, // <-- UPDATE BLOCK
      // onTrainDataUpdate (Restore original logic)
      (data) => { // <-- RESTORE BLOCK
          console.log('[App] Received trainDataUpdate', data);
          // Ensure departures is always an array
          setCurrentDepartures(data.departures || []); // Update departures list
          if (data.error) { setBackendError(`Train Data Error: ${data.error}`); } // Show error if backend sent one
      }, // <-- RESTORE BLOCK
      // onSequenceStopped (Restore original logic)
      () => { /* Handle sequence stopped if needed */ console.log('[App] Received sequenceStopped (callback restored)'); }, // <-- RESTORE
      // onConnect (Restore original logic)
      () => { // <-- RESTORE BLOCK
        console.log('[App] Socket connected (onConnect callback)');
        setIsConnectedToBackend(true);
        setBackendError(null);
        socketService.emitGetMqttStatus(); // Ask for MQTT status on connect
      }, // <-- RESTORE BLOCK
      // onDisconnect (Restore original logic)
      (reason) => { // <-- RESTORE BLOCK
        console.log(`[App] Socket disconnected (onDisconnect callback): ${reason}`);
        setIsConnectedToBackend(false);
        setBackendError(`Disconnected: ${reason}`);
        setDisplayMqttStatus({ status: 'unknown', error: null }); // Reset MQTT status
      }, // <-- RESTORE BLOCK
      // onError (Restore original logic)
      (message) => { // <-- RESTORE BLOCK
        console.error(`[App] Socket error (onError callback): ${message}`);
        setIsConnectedToBackend(false); // Assume disconnect on error
        setBackendError(message);
      } // <-- RESTORE BLOCK
    );

    // Cleanup on unmount
    return () => {
      console.log('[App] useEffect cleanup: Disconnecting socket...');
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
       if (newCaretPos < SPLITFLAP_DISPLAY_LENGTH) {
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
      if (newCaretPos < SPLITFLAP_DISPLAY_LENGTH) {
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
      if (charToInsert !== null && newCaretPos < SPLITFLAP_DISPLAY_LENGTH) {
         newDraft[newCaretPos] = charToInsert;
         if (newCaretPos < SPLITFLAP_DISPLAY_LENGTH) { // Move caret forward after typing if not at the very end
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
      const approxCharWidth = displayRect.width / SPLITFLAP_DISPLAY_LENGTH;
      const clickedIndex = Math.floor(clickX / approxCharWidth);
      setCaretPosition(Math.max(0, Math.min(SPLITFLAP_DISPLAY_LENGTH, clickedIndex))); // Clamp index
      event.currentTarget.focus(); // Ensure display gets focus on click
  };

  // --- Emitter Wrappers ---
  // Wrapper for modes that just send a single text message (like Train Timetable 'Send' button)
  const handleSendText = (text: string) => {
      socketService.emitSetText(text);
  };

  // Stopwatch Emitters
  const handleStartStopwatch = () => {
      console.log('[App] handleStartStopwatch called. Emitting startStopwatch...'); // <-- ADD LOG
      socketService.emitStartStopwatch();
  };
  const handleStopStopwatch = () => {
      console.log('[App] handleStopStopwatch called. Emitting stopStopwatch...'); // <-- ADD LOG
      socketService.emitStopStopwatch();
  };
  const handleResetStopwatch = () => {
      console.log('[App] handleResetStopwatch called. Emitting resetStopwatch...'); // <-- ADD LOG
      socketService.emitResetStopwatch();
  };

  // Sequence Emitters
  const handlePlaySequence = (scene: Scene) => { // Use correct Scene type
      socketService.emitPlaySequence(scene);
  };
  const handleStopSequence = () => {
      socketService.emitStopSequence();
  };
  // Train Emitter (Placeholder - TrainTimetableMode will call this)
  const handleStartTrainUpdates = (fromCRS: string, toCRS?: string) => {
      // This function is passed to TrainTimetableMode, but the actual emit
      // might be better handled within TrainTimetableMode itself when needed.
      // For now, keep the emit call here if App is managing the request trigger.
      // If TrainTimetableMode manages its own data fetching via backend events,
      // this might just become a prop to indicate activity.
      console.log(`[App] Requesting train updates for ${fromCRS} -> ${toCRS || 'any'}`);
      socketService.emitStartTrainUpdates(fromCRS, toCRS); // Decide if App or TrainMode triggers this
  };

  // --- Timer Emitters --- <-- ADD THIS BLOCK
  const handleSetTimer = (durationMinutes: number) => {
      const durationMs = durationMinutes * 60 * 1000;
      console.log(`[App] Setting timer duration: ${durationMinutes} mins (${durationMs} ms)`);
      socketService.emitSetTimer(durationMs);
  };
  const handleStartTimer = () => {
      console.log('[App] Starting timer');
      socketService.emitStartTimer();
  };
  const handleStopTimer = () => {
      console.log('[App] Stopping timer');
      socketService.emitStopTimer();
  };
  // --- End Timer Emitters ---

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

      {/* Display Backend Connection Status - No longer needs wrapper div */}
      <p className={`status-indicator ${isConnectedToBackend ? 'connected' : 'disconnected'}`}>
          Backend: {isConnectedToBackend ? 'Connected' : 'Disconnected'}
          {backendError && <span className="error-text"> ({backendError})</span>}
      </p>
      {/* Display Display MQTT Connection Status - No longer needs wrapper div */}
      <p className={`status-indicator ${displayMqttStatus.status === 'connected' ? 'connected' : (displayMqttStatus.status === 'error' || displayMqttStatus.status === 'disconnected' ? 'disconnected' : 'connecting')}`}>
          Display MQTT: {displayMqttStatus.status}
          {displayMqttStatus.error && <span className="error-text"> ({displayMqttStatus.error})</span>}
      </p>
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
      <div className="mode-selector govuk-button-group"> {/* Add GDS button group class */}
          {/* Use handleSetMode to request change via backend */}
          <button onClick={() => handleSetMode('text')} disabled={currentMode === 'text'} className={`govuk-button ${currentMode !== 'text' ? 'govuk-button--secondary' : ''}`} data-module="govuk-button">Text Input</button>
          <button onClick={() => handleSetMode('train')} disabled={currentMode === 'train'} className={`govuk-button ${currentMode !== 'train' ? 'govuk-button--secondary' : ''}`} data-module="govuk-button">Train Times</button>
          <button onClick={() => handleSetMode('sequence')} disabled={currentMode === 'sequence'} className={`govuk-button ${currentMode !== 'sequence' ? 'govuk-button--secondary' : ''}`} data-module="govuk-button">Sequence</button>
          <button onClick={() => handleSetMode('clock')} disabled={currentMode === 'clock'} className={`govuk-button ${currentMode !== 'clock' ? 'govuk-button--secondary' : ''}`} data-module="govuk-button">Clock</button>
          <button onClick={() => handleSetMode('stopwatch')} disabled={currentMode === 'stopwatch'} className={`govuk-button ${currentMode !== 'stopwatch' ? 'govuk-button--secondary' : ''}`} data-module="govuk-button">Stopwatch</button>
          {/* Add Timer Button */}
          <button onClick={() => handleSetMode('timer')} disabled={currentMode === 'timer'} className={`govuk-button ${currentMode !== 'timer' ? 'govuk-button--secondary' : ''}`} data-module="govuk-button">Timer</button>
      </div>

      {/* Mode Specific Controls */}
      <div className="mode-controls">
          {currentMode === 'train' && (
              <TrainTimetableMode
                  isConnected={isConnectedToBackend}
                  onSendMessage={handleSendText}
                  onStartUpdates={handleStartTrainUpdates}
                  departures={currentDepartures}
              />
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
                displayTime={displayText}
                isRunningBackend={stopwatchIsRunningBackend}
                onStart={handleStartStopwatch}
                onStop={handleStopStopwatch}
                onReset={handleResetStopwatch}
             />
          )}
          {/* --- UNCOMMENT AND UPDATE TimerMode --- */}
          {currentMode === 'timer' && (
             <TimerMode
                isConnectedToBackend={isConnectedToBackend}
                isRunningBackend={timerIsRunningBackend}
                remainingMsBackend={timerRemainingMs}
                targetMsBackend={timerTargetMs}
                onSetTimer={handleSetTimer}
                onStartTimer={handleStartTimer}
                onStopTimer={handleStopTimer}
             />
          )}
          {/* --- END TimerMode --- */}
      </div>
      {/* END OF BLOCK TO UNCOMMENT */}


      {/* Final conditional paragraph removed */}

    </div>
  );
}

export default App;
