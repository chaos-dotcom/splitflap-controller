import mqtt, { MqttClient, IClientOptions } from 'mqtt';

// Define the settings structure expected by the service
interface MqttConnectOptions {
  brokerUrl: string;
  subscribeTopic?: string; // Optional topic to subscribe to on connect
  username?: string;
  password?: string;
  onConnectCallback: () => void;
  onErrorCallback: (error: Error | string) => void;
  onMessageCallback: (topic: string, message: Buffer) => void;
  onCloseCallback: () => void; // Callback for when connection closes
}

let client: MqttClient | null = null;
// let currentSubscribeTopic: string | null = null; // Removed - Not used

export const mqttService = {
  connect: ({
    brokerUrl,
    subscribeTopic,
    username,
    password,
    onConnectCallback,
    onErrorCallback,
    onMessageCallback,
    onCloseCallback,
  }: MqttConnectOptions): void => {
    if (client && client.connected) {
      console.warn('MQTT client already connected. Disconnecting previous before reconnecting.');
      mqttService.disconnect();
      // Allow a moment for disconnect to process if needed, though usually handled by client.end callback
      // Alternatively, manage state more carefully in App.tsx to prevent rapid connect/disconnect calls
    }
     if (client) {
      console.warn('MQTT client is currently connecting/disconnecting. Please wait.');
      // Prevent new connection attempts while another is in progress or cleanup hasn't finished
      // onErrorCallback("Connection attempt already in progress or client cleanup pending.");
      // return; // Or handle state more robustly in App.tsx
      // For simplicity now, we'll proceed, but this could lead to issues if called rapidly.
      // A better approach involves disabling the connect button until the state is fully idle.
       mqttService.disconnect(); // Force disconnect if client exists but isn't connected
    }


    const options: IClientOptions = {
      clientId: `splitflap_webui_${Math.random().toString(16).substr(2, 8)}`,
      clean: true,
      connectTimeout: 4000, // milliseconds
      reconnectPeriod: 1000, // milliseconds
      // Note: MQTT over HTTP is not standard. Browsers use WebSockets (ws:// or wss://)
      // The 'mqtt' library handles ws/wss protocols automatically based on the URL.
    };

    if (username) {
      options.username = username;
    }
    if (password) {
      options.password = password;
    }

    console.log(`Attempting to connect to MQTT broker: ${brokerUrl}`);
    try {
      // Ensure previous client listeners are removed if any instance somehow persists
       if (client) {
           client.removeAllListeners();
       }
      client = mqtt.connect(brokerUrl, options);
    } catch (error) {
        console.error("Failed to create MQTT client:", error);
        onErrorCallback(error instanceof Error ? error : new Error(String(error)));
        client = null; // Ensure client is null on creation error
        return;
    }

    // currentSubscribeTopic = subscribeTopic || null; // Removed - Not used

    // Clear existing listeners before attaching new ones to prevent duplicates
    client.removeAllListeners();

    client.on('connect', () => {
      console.log('MQTT client connected successfully.');
      onConnectCallback();
      // Subscribe if a topic is provided
      if (subscribeTopic && subscribeTopic.trim() !== '') {
        client?.subscribe(subscribeTopic, { qos: 0 }, (err) => {
          if (err) {
            console.error(`Failed to subscribe to topic "${subscribeTopic}":`, err);
            onErrorCallback(`Failed to subscribe: ${err.message}`);
          } else {
            console.log(`Subscribed successfully to topic: "${subscribeTopic}"`);
          }
        });
      }
    });

    client.on('error', (err) => {
      console.error('MQTT client error:', err);
      onErrorCallback(err);
      // Attempt to clean up the client on critical errors
      client?.end(true); // Force close
      client = null; // Nullify the client reference
    });

    client.on('close', () => {
      console.log('MQTT client connection closed.');
       // Check if client is already null to prevent calling onCloseCallback multiple times
       if (client !== null) {
           client = null; // Nullify the client reference first
           onCloseCallback(); // Notify App component
       }
    });

    client.on('message', (topic, message) => {
      // console.log(`Received message on topic "${topic}": ${message.toString()}`); // Reduce noise
      onMessageCallback(topic, message);
    });

    // Handle reconnection attempts (e.g., if network drops temporarily)
    client.on('reconnect', () => {
        console.log('MQTT client attempting to reconnect...');
        // Resubscribe automatically if needed upon successful reconnect
        // The 'connect' event will fire again if reconnection is successful
    });
  },

  disconnect: (): void => {
    if (client) {
      console.log('Disconnecting MQTT client...');
      const tempClient = client; // Hold reference for cleanup
      client = null; // Set to null immediately to prevent race conditions/re-entry
      // currentSubscribeTopic = null; // Removed - Not used

      tempClient.end(true, () => { // Pass true to force close
        console.log('MQTT client disconnected callback.');
        // Ensure all listeners are removed on explicit disconnect
        tempClient.removeAllListeners();
      });
    } else {
      console.warn('MQTT client is not connected or already disconnecting.');
    }
  },

  publish: (topic: string, message: string): void => {
    if (client && client.connected) {
      client.publish(topic, message, { qos: 0, retain: false }, (err) => {
        if (err) {
          console.error(`Failed to publish message to topic "${topic}":`, err);
        } else {
          // console.log(`Message published successfully to topic "${topic}": ${message}`); // Reduce console noise
        }
      });
    } else {
      console.warn('MQTT client not connected. Cannot publish message.');
      // Optionally, implement message queueing here if needed
    }
  },

  getClient: (): MqttClient | null => {
    return client;
  }
};
