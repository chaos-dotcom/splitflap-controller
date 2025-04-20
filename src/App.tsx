import { useState, useEffect } from 'react'; // Import useEffect
import { useState, useEffect } from 'react'; // Import useEffect
import './App.css';
import SplitFlapDisplay from './components/SplitFlapDisplay';
import SettingsPanel from './components/SettingsPanel';
import TextInputMode from './components/TextInputMode'; // Import TextInputMode
import { DISPLAY_LENGTH } from './constants';
import { mqttService } from './services/mqttService';
import { Buffer } from 'buffer';
window.Buffer = Buffer; // Polyfill Buffer for the mqtt library in browser if needed

// Define the settings type inline or import from types/index.ts later
interface MqttSettings {
  brokerUrl: string;
  publishTopic: string;
  subscribeTopic: string;
  username?: string;
  password?: string;
}

function App() {
  const [displayText, setDisplayText] = useState<string>(' '.repeat(DISPLAY_LENGTH));
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

  // Function to update display text (will later also publish via MQTT)
  const sendMessage = (message: string) => {
    console.log(`Updating display to: ${message}`);
    const formattedMessage = message.padEnd(DISPLAY_LENGTH).substring(0, DISPLAY_LENGTH);
    setDisplayText(formattedMessage);
    // TODO: Add MQTT publish logic here if connected
    if (isConnected && mqttSettings.publishTopic) {
      mqttService.publish(mqttSettings.publishTopic, formattedMessage);
    }
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


      {/* Split Flap Display */}
      <SplitFlapDisplay text={displayText} />

      {/* Remove the separate status paragraph */}
      {/* <p>MQTT Status: {isConnected ? 'Connected' : 'Disconnected'}</p> */}

      {/* Split Flap Display */}
      <SplitFlapDisplay text={displayText} />

      {/* Control Panel - TextInputMode */}
      <TextInputMode
        onSendText={sendMessage}
        maxLength={DISPLAY_LENGTH}
        disabled={!isConnected} // Disable input if not connected
      />

      {/* Remove the separate status paragraph */}
      {/* <p>MQTT Status: {isConnected ? 'Connected' : 'Disconnected'}</p> */}

    </div>
  );
}

export default App;
