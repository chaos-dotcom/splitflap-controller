import { useState, useEffect, KeyboardEvent, useCallback } from 'react'; // Import useEffect, KeyboardEvent, useCallback
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
  // --- Scene State ---
  const [sceneNames, setSceneNames] = useState<string[]>([]); // List of available scene names from backend
  const [loadedScene, setLoadedScene] = useState<Scene | null>(null); // Data of the scene loaded for editing
  // --- End Scene State ---

  // --- Authentication State ---
  const [oidcEnabled] = useState<boolean>(import.meta.env.VITE_OIDC_ENABLED === 'true');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false); // To prevent rendering before check
  const [userInfo, setUserInfo] = useState<any>(null); // Store basic user info if needed
  // --- End Authentication State ---


  // Update draft text when display text changes (e.g., from backend or initial load)
  useEffect(() => {
    setDraftText(displayText.padEnd(SPLITFLAP_DISPLAY_LENGTH)); // Ensure draft matches length
    // Optionally reset caret, or try to maintain position if practical
    // setCaretPosition(0); // Reset caret when display updates externally for simplicity
  }, [displayText]);

    // --- Define Callbacks ---
    // Wrap callbacks that modify state in useCallback to prevent unnecessary re-renders if passed down
    const handleInitialState = useCallback((state: Parameters<ServerToClientEvents['initialState']>[0]) => {
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
    }, []); // Empty dependency array as it only uses setters

    const handleDisplayUpdate = useCallback((data: Parameters<ServerToClientEvents['displayUpdate']>[0]) => {
        setDisplayText(data.text);
    }, []);

    const handleModeUpdate = useCallback((data: Parameters<ServerToClientEvents['modeUpdate']>[0]) => {
        console.log(`[App] Received modeUpdate event from backend with mode: ${data.mode}`);
        setCurrentMode(data.mode);
    }, []);

    const handleMqttStatus = useCallback((status: Parameters<ServerToClientEvents['mqttStatus']>[0]) => {
        setDisplayMqttStatus(status);
    }, []);

    const handleStopwatchUpdate = useCallback((data: Parameters<ServerToClientEvents['stopwatchUpdate']>[0]) => {
        console.log('[App] Received stopwatchUpdate:', data);
        setStopwatchIsRunningBackend(data.isRunning);
    }, []);

    const handleTimerUpdate = useCallback((data: Parameters<ServerToClientEvents['timerUpdate']>[0]) => {
        console.log('[App] Received timerUpdate', data);
        setTimerIsRunningBackend(data.isRunning);
        setTimerRemainingMs(data.remainingMs);
        setTimerTargetMs(data.targetMs);
    }, []);

    const handleTrainDataUpdate = useCallback((data: Parameters<ServerToClientEvents['trainDataUpdate']>[0]) => {
        console.log('[App] Received trainDataUpdate:', data);
        setCurrentDepartures(data.departures || []);
        if (data.error) { setBackendError(`Train Data Error: ${data.error}`); }
    }, []);

    const handleSequenceStopped = useCallback(() => {
        console.log('[App] Received sequenceStopped');
        // Add any state updates needed when sequence stops externally
    }, []);

    // --- Scene Callbacks ---
    const handleSceneListUpdate = useCallback((data: Parameters<ServerToClientEvents['sceneListUpdate']>[0]) => {
        console.log('[App] Received sceneListUpdate:', data.names);
        setSceneNames(data.names || []); // Ensure it's always an array
    }, []);

    const handleSceneLoaded = useCallback((data: Parameters<ServerToClientEvents['sceneLoaded']>[0]) => {
        console.log('[App] Received sceneLoaded:', data.scene?.name);
        setLoadedScene(data.scene || null); // Store the loaded scene data
    }, []);
    // --- End Scene Callbacks ---

    const handleConnect = useCallback(() => {
        console.log('[App] Socket connected (onConnect callback)');
        setIsConnectedToBackend(true);
        setBackendError(null);
        socketService.emitGetMqttStatus(); // Ask for MQTT status on connect
        socketService.emitGetSceneList(); // Ask for scene list on connect
    }, []); // Dependencies: emitGetMqttStatus, emitGetSceneList (from socketService)

    const handleDisconnect = useCallback((reason: string) => {
        console.log(`[App] Socket disconnected (onDisconnect callback): ${reason}`);
        setIsConnectedToBackend(false);
        setBackendError(`Disconnected: ${reason}`);
        setDisplayMqttStatus({ status: 'unknown', error: null }); // Reset MQTT status
        setSceneNames([]); // Clear scene names on disconnect
        setLoadedScene(null); // Clear loaded scene on disconnect
    }, []);

    const handleError = useCallback((message: string | undefined) => { // Allow message to be undefined
        const errorMessage = message || "An unknown connection error occurred."; // Provide default message
        console.error(`[App] Socket error (onError callback): ${errorMessage}`);
        // Don't assume disconnect on all errors, maybe backend sent an operational error
        // setIsConnectedToBackend(false);
        setBackendError(errorMessage);
    }, []);

    // --- Scene Emitter Handlers ---
    const handleGetSceneList = useCallback(() => {
        if (isConnectedToBackend) {
            console.log('[App] Emitting getSceneList');
            socketService.emitGetSceneList();
        }
    }, [isConnectedToBackend]);

    const handleLoadSceneRequest = useCallback((sceneName: string) => {
        if (isConnectedToBackend) {
            console.log(`[App] Emitting loadScene: ${sceneName}`);
            socketService.emitLoadScene(sceneName);
        }
    }, [isConnectedToBackend]);

    const handleSaveSceneRequest = useCallback((sceneName: string, sceneData: Scene) => {
        if (isConnectedToBackend) {
            console.log(`[App] Emitting saveScene: ${sceneName}`);
            socketService.emitSaveScene(sceneName, sceneData);
            // Optionally show a saving indicator here
        }
    }, [isConnectedToBackend]);

    const handleDeleteSceneRequest = useCallback((sceneName: string) => {
        if (isConnectedToBackend) {
            console.log(`[App] Emitting deleteScene: ${sceneName}`);
            socketService.emitDeleteScene(sceneName);
            // Clear loaded scene locally if it's the one being deleted
            if (loadedScene?.name === sceneName) {
                setLoadedScene(null);
            }
        }
    }, [isConnectedToBackend, loadedScene]); // Include loadedScene dependency
    // --- End Scene Emitter Handlers ---
    // --- End Define Callbacks ---

  // --- Socket.IO Connection Effect ---
  useEffect(() => {
      console.log('[App] useEffect: Calling socketService.connect...'); // Add log before connect
      socketService.connect(
          handleInitialState,
          handleDisplayUpdate,
          handleModeUpdate,
          handleMqttStatus,
          handleStopwatchUpdate,
          handleTimerUpdate,
          handleTrainDataUpdate,
          handleSequenceStopped,
          // --- ADD Scene Callbacks ---
          handleSceneListUpdate,
          handleSceneLoaded,
          // --- END Scene Callbacks ---
          handleConnect,
          handleDisconnect,
          handleError
      );

      // Cleanup on unmount
      return () => {
          console.log('[App] useEffect cleanup: Disconnecting socket...');
          socketService.disconnect();
      };
      // Include all callbacks in dependency array
  }, [
      handleInitialState, handleDisplayUpdate, handleModeUpdate, handleMqttStatus,
      handleStopwatchUpdate, handleTimerUpdate, handleTrainDataUpdate, handleSequenceStopped,
      handleSceneListUpdate, handleSceneLoaded, // Add scene callbacks
      handleConnect, handleDisconnect, handleError
  ]);


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
  const handlePlaySequence = (scene: Scene) => { // Scene object now includes loop property
      // Extract loop from the scene object passed from SequenceMode
      const loop = scene.loop ?? false;
      socketService.emitPlaySequence(scene, loop); // Pass scene and loop separately
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
      // Add check for authentication if OIDC is enabled
      if (isConnectedToBackend && (!oidcEnabled || isAuthenticated)) {
          socketService.emitSetMode(mode);
          // Note: The actual state update (setCurrentMode) happens
          // when the backend confirms via the 'modeUpdate' event.
      } else if (!isConnectedToBackend) {
          console.warn("Cannot change mode: Disconnected from backend.");
          setBackendError("Cannot change mode: Disconnected"); // Provide feedback
      } else {
          // OIDC enabled but not authenticated
          console.warn("Cannot change mode: Authentication required.");
          setBackendError("Cannot change mode: Please login"); // Provide feedback
      }
  };
  // --- End Mode Change Handler ---


  return (
    <div className="app-container"> {/* Removed govuk-width-container if you don't want width limit */}
      <h1>Split-Flap Controller</h1>

      {/* --- Auth Controls --- */}
      {oidcEnabled && authChecked && ( // Only show if OIDC enabled and check complete
          <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, padding: '5px' }}>
              {isAuthenticated ? (
                  <>
                      <span style={{ marginRight: '10px', verticalAlign: 'middle' }}>
                          {/* Display user info if available */}
                          {userInfo?.displayName || userInfo?.emails?.[0]?.value || 'Authenticated'}
                      </span>
                      {/* Use VITE_API_BASE_URL for logout link */}
                      <a href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/logout`} className="govuk-button govuk-button--warning govuk-button--small">
                          Logout
                      </a>
                  </>
              ) : (
                  /* Use VITE_API_BASE_URL for login link */
                  <a href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/login`} className="govuk-button govuk-button--small">
                      Login
                  </a>
              )}
          </div>
      )}
      {/* --- End Auth Controls --- */}


      {/* Display Backend Connection Status */}
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


      {/* --- Main Content --- */}
      {/* Wait for auth check before rendering main content if OIDC is enabled */}
      {(!oidcEnabled || authChecked) ? (
          <>
              {/* Conditionally render based on authentication */}
              {isAuthenticated ? (
                  <>
                      {/* Split Flap Display - Now Interactive */}
                      <SplitFlapDisplay
                          text={currentMode === 'text' ? draftText : displayText}
                          caretPosition={caretPosition}
                          onKeyDown={handleDisplayKeyDown}
                          // Display might depend on socket connection primarily
                          isConnected={isConnectedToBackend}
                          onClick={handleDisplayClick}
                          // Interactivity might depend on both connection and auth (if OIDC enabled)
                          isInteractive={currentMode === 'text' && isConnectedToBackend && (!oidcEnabled || isAuthenticated)}
                      />

                      {/* Mode Selector */}
                      <div className="mode-selector govuk-button-group">
                          {/* Disable buttons if not connected OR if OIDC requires auth and not authenticated */}
                          <button onClick={() => handleSetMode('text')} disabled={currentMode === 'text' || !isConnectedToBackend || (oidcEnabled && !isAuthenticated)} className={`govuk-button ${currentMode !== 'text' ? 'govuk-button--secondary' : ''}`} data-module="govuk-button">Text Input</button>
                          <button onClick={() => handleSetMode('train')} disabled={currentMode === 'train' || !isConnectedToBackend || (oidcEnabled && !isAuthenticated)} className={`govuk-button ${currentMode !== 'train' ? 'govuk-button--secondary' : ''}`} data-module="govuk-button">Train Times</button>
                          <button onClick={() => handleSetMode('sequence')} disabled={currentMode === 'sequence' || !isConnectedToBackend || (oidcEnabled && !isAuthenticated)} className={`govuk-button ${currentMode !== 'sequence' ? 'govuk-button--secondary' : ''}`} data-module="govuk-button">Sequence</button>
                          <button onClick={() => handleSetMode('clock')} disabled={currentMode === 'clock' || !isConnectedToBackend || (oidcEnabled && !isAuthenticated)} className={`govuk-button ${currentMode !== 'clock' ? 'govuk-button--secondary' : ''}`} data-module="govuk-button">Clock</button>
                          <button onClick={() => handleSetMode('stopwatch')} disabled={currentMode === 'stopwatch' || !isConnectedToBackend || (oidcEnabled && !isAuthenticated)} className={`govuk-button ${currentMode !== 'stopwatch' ? 'govuk-button--secondary' : ''}`} data-module="govuk-button">Stopwatch</button>
                          <button onClick={() => handleSetMode('timer')} disabled={currentMode === 'timer' || !isConnectedToBackend || (oidcEnabled && !isAuthenticated)} className={`govuk-button ${currentMode !== 'timer' ? 'govuk-button--secondary' : ''}`} data-module="govuk-button">Timer</button>
                      </div>

                      {/* Mode Specific Controls */}
                      {/* Pass isConnectedToBackend and potentially isAuthenticated down */}
                      {/* Components should internally handle disabling based on these props */}
                      <div className="mode-controls">
                          {currentMode === 'train' && (
                              <TrainTimetableMode
                                  isConnected={isConnectedToBackend} // Pass socket status
                                  // Add isAuthenticated prop if TrainTimetableMode needs to disable parts based on auth
                                  // isAuthenticated={isAuthenticated}
                                  onSendMessage={handleSendText}
                                  onStartUpdates={handleStartTrainUpdates}
                                  departures={currentDepartures}
                              />
                          )}
                          {currentMode === 'sequence' && (
                              <SequenceMode
                                  isConnected={isConnectedToBackend} // Pass socket status
                                  // isAuthenticated={isAuthenticated} // Add if needed
                                  onPlay={handlePlaySequence}
                                  onStop={handleStopSequence}
                                  sceneNames={sceneNames}
                                  loadedScene={loadedScene}
                                  onGetSceneList={handleGetSceneList}
                                  onLoadScene={handleLoadSceneRequest}
                                  onSaveScene={handleSaveSceneRequest}
                                  onDeleteScene={handleDeleteSceneRequest}
                              />
                          )}
                          {currentMode === 'clock' && (
                              <ClockMode
                                  isConnectedToBackend={isConnectedToBackend} // Pass socket status
                                  // isAuthenticated={isAuthenticated} // Add if needed
                              />
                          )}
                          {currentMode === 'stopwatch' && (
                              <StopwatchMode
                                  isConnectedToBackend={isConnectedToBackend} // Pass socket status
                                  // isAuthenticated={isAuthenticated} // Add if needed
                                  displayTime={displayText}
                                  isRunningBackend={stopwatchIsRunningBackend}
                                  onStart={handleStartStopwatch}
                                  onStop={handleStopStopwatch}
                                  onReset={handleResetStopwatch}
                              />
                          )}
                          {currentMode === 'timer' && (
                              <TimerMode
                                  isConnectedToBackend={isConnectedToBackend} // Pass socket status
                                  // isAuthenticated={isAuthenticated} // Add if needed
                                  isRunningBackend={timerIsRunningBackend}
                                  remainingMsBackend={timerRemainingMs}
                                  targetMsBackend={timerTargetMs}
                                  onSetTimer={handleSetTimer}
                                  onStartTimer={handleStartTimer}
                                  onStopTimer={handleStopTimer}
                              />
                          )}
                      </div>
                  </>
              ) : (
                  // OIDC is enabled, auth check done, but user is not authenticated
                  oidcEnabled && <div className="govuk-warning-text">
                      <span className="govuk-warning-text__icon" aria-hidden="true">!</span>
                      <strong className="govuk-warning-text__text">
                          <span className="govuk-warning-text__assistive">Warning</span>
                          Please <a href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/login`}>login</a> to control the display.
                      </strong>
                  </div>
              )}
          </>
      ) : (
          // Optional: Show a loading indicator while auth check is in progress
          <p className="govuk-body">Checking authentication status...</p>
      )}
      {/* --- End Main Content --- */}

    </div>
  );
}

export default App;
