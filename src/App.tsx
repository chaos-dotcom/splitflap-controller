import { useState } from 'react';
import './App.css';
import SplitFlapDisplay from './components/SplitFlapDisplay';
import SettingsPanel from './components/SettingsPanel'; // Import SettingsPanel
import { DISPLAY_LENGTH } from './constants';

// Define the settings type inline or import from types/index.ts later
interface MqttSettings {
  brokerUrl: string;
  publishTopic: string;
  subscribeTopic: string;
}

function App() {
  const [displayText, setDisplayText] = useState<string>(' '.repeat(DISPLAY_LENGTH));
  const [isConnected, setIsConnected] = useState<boolean>(false);
  // Add subscribeTopic to state
  const [mqttSettings, setMqttSettings] = useState<MqttSettings>({
    brokerUrl: 'ws://broker.hivemq.com:8000/mqtt', // Public test broker
    publishTopic: 'splitflap/test/set_text',     // Example topic
    subscribeTopic: 'splitflap/test/status',   // Example topic
  });

  // Placeholder connection logic
  const handleConnect = (settings: MqttSettings) => {
    console.log('Connecting with settings:', settings);
    // TODO: Implement actual MQTT connection using mqttService
    setMqttSettings(settings); // Update settings state
    // Simulate connection success for UI testing
    setIsConnected(true);
    console.log('Simulated connection success');
  };

  // Placeholder disconnection logic
  const handleDisconnect = () => {
    console.log('Disconnecting...');
    // TODO: Implement actual MQTT disconnection using mqttService
    setIsConnected(false);
    console.log('Simulated disconnection');
  };

  // Function to update display text (will later also publish via MQTT)
  const sendMessage = (message: string) => {
    console.log(`Updating display to: ${message}`);
    const formattedMessage = message.padEnd(DISPLAY_LENGTH).substring(0, DISPLAY_LENGTH);
    setDisplayText(formattedMessage);
    // TODO: Add MQTT publish logic here if connected
    if (isConnected) {
      console.log(`Publishing "${formattedMessage}" to topic "${mqttSettings.publishTopic}" (not implemented yet)`);
      // mqttService.publish(mqttSettings.publishTopic, formattedMessage);
    }
  };

  // Handler for settings changes from the panel
  const handleSettingsChange = (newSettings: MqttSettings) => {
    setMqttSettings(newSettings);
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

      {/* Split Flap Display */}
      <SplitFlapDisplay text={displayText} />

      {/* Remove the separate status paragraph */}
      {/* <p>MQTT Status: {isConnected ? 'Connected' : 'Disconnected'}</p> */}

      {/* Control Panel Placeholder */}
      <div className="control-placeholder" style={{ border: '1px dashed green', padding: '10px', margin: '10px 0', width: '90%', maxWidth: '600px' }}>
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
