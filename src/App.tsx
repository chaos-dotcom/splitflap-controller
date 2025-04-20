import { useState } from 'react';
import './App.css'; // Keep default App CSS for now
import SplitFlapDisplay from './components/SplitFlapDisplay'; // Import the display component
import { DISPLAY_LENGTH } from './constants'; // Import constants

function App() {
  // State to hold the text for the display
  const [displayText, setDisplayText] = useState<string>(' '.repeat(DISPLAY_LENGTH));
  // Placeholder state for MQTT connection (not functional yet)
  const [isConnected, setIsConnected] = useState<boolean>(false);
  // Placeholder state for MQTT settings (not functional yet)
  const [mqttSettings, setMqttSettings] = useState({
    brokerUrl: 'ws://localhost:9001', // Example default
    topic: 'splitflap/set_text',     // Example default
  });

  // Function to update the display text state
  const sendMessage = (message: string) => {
    console.log(`Updating display to: ${message}`);
    // Ensure message is padded/truncated to DISPLAY_LENGTH
    const formattedMessage = message.padEnd(DISPLAY_LENGTH).substring(0, DISPLAY_LENGTH);
    setDisplayText(formattedMessage); // Update state, React re-renders SplitFlapDisplay
  };

  return (
    <div className="app-container">
      <h1>Split-Flap Controller</h1>

      {/* Render the actual SplitFlapDisplay component */}
      <SplitFlapDisplay text={displayText} />

      <p>MQTT Status: {isConnected ? 'Connected' : 'Disconnected'}</p>

      {/* Placeholder for settings panel */}
      <div className="settings-placeholder" style={{ border: '1px dashed blue', padding: '10px', margin: '10px 0', width: '90%' }}>
        Settings Panel Placeholder (Broker: {mqttSettings.brokerUrl}, Topic: {mqttSettings.topic})
      </div>

      {/* Placeholder for control panel with test buttons */}
      <div className="control-placeholder" style={{ border: '1px dashed green', padding: '10px', margin: '10px 0', width: '90%' }}>
        Control Panel Placeholder
        {/* Button to send a test message */}
        <button onClick={() => sendMessage('HELLO WORLD?')}>Send Test</button>
        {/* Button to test color codes */}
        <button onClick={() => sendMessage('rgybvp tw ?')}>Send Colors</button>
      </div>

    </div>
  );
}

export default App;
