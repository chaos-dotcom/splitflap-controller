import React, { useState, useEffect } from 'react';
import './SettingsPanel.css';

interface MqttSettings {
  brokerUrl: string;
  publishTopic: string;
  subscribeTopic: string;
  username?: string; // Optional username
  password?: string; // Optional password
}

interface SettingsPanelProps {
  initialSettings: MqttSettings;
  isConnected: boolean;
  onConnect: (settings: MqttSettings) => void;
  onDisconnect: () => void;
  onSettingsChange: (settings: MqttSettings) => void; // To update App state immediately
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  initialSettings,
  isConnected,
  onConnect,
  onDisconnect,
  onSettingsChange,
}) => {
  const [settings, setSettings] = useState<MqttSettings>(initialSettings);

  // Update local state if initialSettings prop changes (e.g., loaded from storage later)
  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    const newSettings = { ...settings, [name]: value };
    setSettings(newSettings);
    onSettingsChange(newSettings); // Update App state as user types
  };

  const handleConnect = () => {
    onConnect(settings);
  };

  const handleDisconnect = () => {
    onDisconnect();
  };

  return (
    <div className="settings-panel">
      <h3>MQTT Settings</h3>
      <div className="form-group">
        <label htmlFor="brokerUrl">Broker URL:</label>
        <input
          type="text"
          id="brokerUrl"
          name="brokerUrl"
          value={settings.brokerUrl}
          onChange={handleChange}
          disabled={isConnected}
          placeholder="Use ws:// or wss:// (e.g., wss://broker.hivemq.com:8884/mqtt)"
        />
      </div>
      <div className="form-group">
        <label htmlFor="publishTopic">Publish Topic:</label>
        <input
          type="text"
          id="publishTopic"
          name="publishTopic"
          value={settings.publishTopic}
          onChange={handleChange}
          disabled={isConnected}
          placeholder="e.g., splitflap/set_text"
        />
      </div>
      <div className="form-group">
        <label htmlFor="subscribeTopic">Subscribe Topic:</label>
        <input
          type="text"
          id="subscribeTopic"
          name="subscribeTopic"
          value={settings.subscribeTopic}
          onChange={handleChange}
          disabled={isConnected}
          placeholder="e.g., splitflap/status (optional)"
        />
      </div>
      <div className="form-group">
        <label htmlFor="username">Username:</label>
        <input
          type="text"
          id="username"
          name="username"
          value={settings.username || ''}
          onChange={handleChange}
          disabled={isConnected}
          placeholder="(Optional)"
        />
      </div>
      <div className="form-group">
        <label htmlFor="password">Password:</label>
        <input
          type="password"
          id="password"
          name="password"
          value={settings.password || ''}
          onChange={handleChange}
          disabled={isConnected}
        />
      </div>
      <div className="button-group">
        <button onClick={handleConnect} disabled={isConnected}>
          Connect
        </button>
        <button onClick={handleDisconnect} disabled={!isConnected}>
          Disconnect
        </button>
      </div>
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
    </div>
  );
};

export default SettingsPanel;
