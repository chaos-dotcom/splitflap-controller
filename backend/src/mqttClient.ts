import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import dotenv from 'dotenv';

dotenv.config(); // Load .env variables

const brokerUrl = process.env.DISPLAY_MQTT_BROKER_URL;
const publishTopic = process.env.DISPLAY_MQTT_TOPIC;
const username = process.env.DISPLAY_MQTT_USERNAME;
const password = process.env.DISPLAY_MQTT_PASSWORD;

let client: MqttClient | null = null;
let connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
let lastError: string | null = null;

const options: IClientOptions = {
    clientId: `splitflap_backend_${Math.random().toString(16).substr(2, 8)}`,
    clean: true,
    connectTimeout: 5000,
    reconnectPeriod: 5000, // Attempt reconnect every 5 seconds
    // Add username/password if they exist
    ...(username && { username }),
    ...(password && { password }),
};

export const connectToDisplayBroker = (): void => {
    if (!brokerUrl || !publishTopic) {
        console.error('[MQTT Client] Error: DISPLAY_MQTT_BROKER_URL and DISPLAY_MQTT_TOPIC must be set in .env');
        connectionStatus = 'error';
        lastError = 'Missing MQTT configuration in .env';
        return;
    }

    if (client && (client.connected || client.connecting)) {
        console.log('[MQTT Client] Already connected or connecting.');
        return;
    }

    console.log(`[MQTT Client] Attempting to connect to display broker: ${brokerUrl}`);
    connectionStatus = 'connecting';
    lastError = null;
    client = mqtt.connect(brokerUrl, options);

    client.on('connect', () => {
        console.log('[MQTT Client] Connected successfully to display broker.');
        connectionStatus = 'connected';
        lastError = null;
        // Optionally subscribe to status topics from the display itself here if needed
    });

    client.on('error', (err) => {
        console.error('[MQTT Client] Connection error:', err.message);
        connectionStatus = 'error';
        lastError = err.message;
        // client?.end(); // Let reconnectPeriod handle retries
    });

    client.on('reconnect', () => {
        console.log('[MQTT Client] Attempting to reconnect...');
        connectionStatus = 'connecting';
    });

    client.on('close', () => {
        console.log('[MQTT Client] Connection closed.');
        // Don't set status to disconnected immediately if reconnectPeriod > 0
        // It will transition to 'connecting' on 'reconnect' event
        if (connectionStatus !== 'connecting') {
             connectionStatus = 'disconnected';
        }
    });

    client.on('offline', () => {
        console.log('[MQTT Client] Client offline.');
        connectionStatus = 'disconnected';
    });
};

export const publishToDisplay = (message: string): boolean => {
    if (!client || !client.connected || !publishTopic) {
        console.warn('[MQTT Client] Cannot publish: Not connected or topic not set.');
        return false;
    }
    client.publish(publishTopic, message, { qos: 0, retain: false }, (err) => {
        if (err) {
            console.error(`[MQTT Client] Failed to publish message to topic "${publishTopic}":`, err);
        } else {
             console.log(`[MQTT Client] Published "${message}" to ${publishTopic}`);
        }
    });
    return true;
};

export const disconnectFromDisplayBroker = (): void => {
    if (client) {
        console.log('[MQTT Client] Disconnecting from display broker...');
        client.end(true); // Force close, disable reconnect
        client = null;
        connectionStatus = 'disconnected';
    }
};

export const getDisplayConnectionStatus = (): { status: string; error: string | null } => {
    return { status: connectionStatus, error: lastError };
};
