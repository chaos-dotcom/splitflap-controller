import { useState, useEffect, KeyboardEvent } from 'react'; // Import useEffect, KeyboardEvent
import './App.css';
import SplitFlapDisplay from './components/SplitFlapDisplay';
import SettingsPanel from './components/SettingsPanel';
import TrainTimetableMode from './components/TrainTimetableMode'; // Import placeholder
import { DISPLAY_LENGTH, ALLOWED_CHARS } from './constants'; // Import ALLOWED_CHARS
import { mqttService } from './services/mqttService';
import { ControlMode, MqttSettings } from './types'; // Import types
import { Buffer } from 'buffer';
window.Buffer = Buffer; // Polyfill Buffer for the mqtt library in browser if needed

function App() {
  const [displayText, setDisplayText] = useState<string>(' '.repeat(DISPLAY_LENGTH));
  const [draftText, setDraftText] = useState<string>(' '.repeat(DISPLAY_LENGTH)); // State for inline editing
  const [caretPosition, setCaretPosition] = useState<number>(0); // State for cursor position
  const [currentMode, setCurrentMode] = useState<ControlMode>('text'); // State for current control mode
  const [isConnected, setIsConnected] = useState<boolean>(false);
  // Add subscribeTopic to state
  const [mqttSettings, setMqttSettings] = useState<MqttSettings>({
    brokerUrl: 'ws://broker.hivemq.com:8000/mqtt', // Public test broker
    publishTopic: 'splitflap/test/set_text',     // Example topic
    subscribeTopic: 'splitflap/test/status',   // Example topic
    username: '',
    password: '',
  });
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Update draft text when display text changes (e.g., from MQTT message or initial load)
  useEffect(() => {
    setDraftText(displayText);
    // Optionally reset caret, or try to maintain position if practical
    // setCaretPosition(0); // Reset caret when display updates externally for simplicity
  }, [displayText]);


  // MQTT Connection Logic
  const handleConnect = (settings: MqttSettings) => {
    console.log('Connecting with settings:', settings);
    setConnectionError(null); // Clear previous errors

    // Validate Broker URL scheme
    if (!settings.brokerUrl.startsWith('ws://') && !settings.brokerUrl.startsWith('wss://')) {
      setConnectionError('Invalid Broker URL: Must start with ws:// or wss://');
      setIsConnected(false); // Ensure status reflects failure
      return; // Prevent connection attempt
    }

   /* src/App.css */
   /* ... existing styles ... */

   .mode-selector {
     margin-top: 20px;
     text-align: center;
     padding-bottom: 15px;
     border-bottom: 1px solid #eee;
   }

   .mode-selector button {
     padding: 8px 16px;
     margin: 0 10px;
     font-size: 1rem;
     cursor: pointer;
     border: 1px solid #ccc;
     background-color: #f0f0f0;
     border-radius: 4px;
   }

   .mode-selector button:disabled {
     background-color: #4a90e2; /* Highlight active mode */
     color: white;
     border-color: #4a90e2;
     cursor: default;
   }

   .mode-controls {
     margin-top: 15px;
     width: 90%;
     max-width: 600px; /* Or match settings panel width */
     /* Center the controls container */
     margin-left: auto;
     margin-right: auto;
     display: flex; /* Use flexbox to help center content if needed */
     justify-content: center;
   }

    setMqttSettings(settings); // Store the settings used for connection attempt

    mqttService.connect({
      brokerUrl: settings.brokerUrl,
      subscribeTopic: settings.subscribeTopic,
      username: settings.username,
      password: settings.password,
      onConnectCallback: () => {
        setIsConnected(true);
        setConnectionError(null);
      },
      onErrorCallback: (error) => {
        setIsConnected(false);
        setConnectionError(typeof error === 'string' ? error : error.message);
        console.error("Connection Error:", error);
      },
      onMessageCallback: (topic, message) => {
        // console.log(`App received message on ${topic}: ${message.toString()}`); // Reduce noise
        // Example: Update display if message is on subscribe topic
        if (settings.subscribeTopic && topic === settings.subscribeTopic) { // Check subscribeTopic exists
          const receivedText = message.toString();
          // Optionally validate/sanitize receivedText against ALLOWED_CHARS
          const formattedMessage = receivedText.padEnd(DISPLAY_LENGTH).substring(0, DISPLAY_LENGTH);
          setDisplayText(formattedMessage);
        }
      },
      onCloseCallback: () => {
        // Handle unexpected disconnects
        if (isConnected) { // Only show error if we thought we were connected
            setIsConnected(false);
            setConnectionError("Connection closed unexpectedly.");
        }
      }
    });
  };

  const handleDisconnect = () => {
    mqttService.disconnect();
    setIsConnected(false);
    setConnectionError(null); // Clear error on manual disconnect
  };

  // Function to publish a message via MQTT
  const publishMessage = (message: string) => {
    if (!isConnected || !mqttSettings.publishTopic) return;

    // Ensure message is correct length before publishing
    const formattedMessage = message.padEnd(DISPLAY_LENGTH).substring(0, DISPLAY_LENGTH);
    console.log(`Publishing message: ${formattedMessage}`);
    setDisplayText(formattedMessage); // Update the "official" display state
    mqttService.publish(mqttSettings.publishTopic, formattedMessage);
    // Consider resetting caret after sending, or leave it
    // setCaretPosition(0);
  };

  // Handler for settings changes from the panel
  const handleSettingsChange = (newSettings: MqttSettings) => {
    setMqttSettings(newSettings);
  };

  // Effect for cleanup on component unmount
  useEffect(() => {
    // Return a cleanup function
    return () => {
      mqttService.disconnect();
    };
  }, []); // Empty dependency array means this runs only on mount and unmount

  // --- Handlers for Interactive Display ---
  const handleDisplayKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Only handle keys if connected AND in text mode
    if (!isConnected || currentMode !== 'text') return;

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
      // Only handle clicks if connected AND in text mode
      if (!isConnected || currentMode !== 'text') return;
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

      {/* Settings Panel */}
      <SettingsPanel
        initialSettings={mqttSettings}
        isConnected={isConnected}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onSettingsChange={handleSettingsChange} // Pass the handler
      />
      {/* Display connection error */}
      {connectionError && (
        <p style={{ color: 'red', textAlign: 'center' }}>Error: {connectionError}</p>
      )}


      {/* Split Flap Display - Now Interactive */}
      <SplitFlapDisplay
        // Show draft text only when in text mode, otherwise show last published text
        text={currentMode === 'text' ? draftText : displayText}
        caretPosition={caretPosition} // Caret position is only relevant in text mode
        onKeyDown={handleDisplayKeyDown} // Handler checks for mode internally
        isConnected={isConnected} // To enable/disable interaction style
        onClick={handleDisplayClick} // Handler checks for mode internally
        isInteractive={currentMode === 'text'} // Explicitly pass if display should be interactive
      />

      {/* Mode Selector */}
      <div className="mode-selector">
          <button onClick={() => setCurrentMode('text')} disabled={currentMode === 'text'}>Text Input Mode</button>
          <button onClick={() => setCurrentMode('train')} disabled={currentMode === 'train'}>Train Timetable Mode</button>
      </div>

      {/* Mode Specific Controls */}
      <div className="mode-controls">
          {currentMode === 'train' && (
              <TrainTimetableMode isConnected={isConnected} onSendMessage={publishMessage} />
          )}
          {/* Add other mode components here later */}
      </div>

      {!isConnected && (
         <p style={{ textAlign: 'center', marginTop: '10px', color: '#555' }}>
           Connect to MQTT to enable display input.
         </p>
      )}

    </div>
  );
}

export default App;
