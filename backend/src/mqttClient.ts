import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import dotenv from 'dotenv';

dotenv.config(); // Load .env variables

const brokerUrl = process.env.DISPLAY_MQTT_BROKER_URL;
const publishTopic = process.env.DISPLAY_MQTT_TOPIC;
const username = process.env.DISPLAY_MQTT_USERNAME;
const password = process.env.DISPLAY_MQTT_PASSWORD;
const calibrationString = process.env.CALIBRATION_STRING;

// The flap sequence used by the display
const FLAP_SEQUENCE = ' roygbvptABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.=?$&!';

let client: MqttClient | null = null;
let connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
let lastError: string | null = null;
// Define a type for the message handler callback
type MessageHandler = (topic: string, message: Buffer) => void;
let messageHandler: MessageHandler | null = null; // Store the handler
let availabilityTopic: string | null = null; // Store the availability topic for LWT

const options: IClientOptions = {
    clientId: `splitflap_backend_${Math.random().toString(16).substr(2, 8)}`,
    clean: true,
    // Last Will and Testament (LWT)
    will: undefined, // Initialize as undefined, will be set in connectToDisplayBroker
    connectTimeout: 5000,
    reconnectPeriod: 5000, // Attempt reconnect every 5 seconds
    // Add username/password if they exist
    ...(username && { username }),
    ...(password && { password }),
};

// Modified connect function to accept the message handler AND availability topic
export const connectToDisplayBroker = (handler: MessageHandler, availTopic: string): void => {
    messageHandler = handler; // Store the handler
    availabilityTopic = availTopic; // Store for potential use elsewhere if needed

    // Configure LWT before connecting
    options.will = {
        topic: availabilityTopic,
        payload: 'offline', // Payload for unavailable state
        qos: 1, // Quality of Service for LWT
        retain: true, // Retain the offline status
    };

    if (!brokerUrl) { // Only brokerUrl is strictly required to connect
        console.error('[MQTT Client] Error: DISPLAY_MQTT_BROKER_URL must be set in .env');
        connectionStatus = 'error';
        lastError = 'Missing MQTT configuration in .env';
        return;
    }

    if (client && (client.connected || client.reconnecting)) { // Use 'reconnecting' instead of 'connecting'
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
        // Call the handler to signal connection (e.g., for publishing discovery)
        if (messageHandler) {
            messageHandler('internal/connect', Buffer.from('connected'));
        }
        // No automatic subscriptions here anymore
    });

    // Add message listener
    client.on('message', (topic, message) => {
        // console.log(`[MQTT Client] Received message on topic ${topic}: ${message.toString()}`); // Optional: Log received messages
        if (messageHandler) {
            messageHandler(topic, message); // Pass to the registered handler
        }
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

// Function to apply calibration offset to a message
const applyCalibration = (message: string): string => {
    // If no calibration string is set, return the original message
    if (!calibrationString) {
        return message;
    }

    return message.split('').map(char => {
        // If character isn't in the flap sequence, return it unchanged
        if (!FLAP_SEQUENCE.includes(char)) {
            return char;
        }
        
        // Find the position in the flap sequence
        const charIndex = FLAP_SEQUENCE.indexOf(char);
        
        // Get the calibration offset for this character
        // If calibration string is shorter than message, wrap around
        const calibrationOffset = parseInt(calibrationString[charIndex % calibrationString.length], 10);
        
        // If calibration value isn't a valid number, return original character
        if (isNaN(calibrationOffset)) {
            return char;
        }
        
        // Apply the offset to get the new character
        const newIndex = (charIndex + calibrationOffset) % FLAP_SEQUENCE.length;
        return FLAP_SEQUENCE[newIndex];
    }).join('');
};

export const publishToDisplay = (message: string): boolean => {
    if (!client || !client.connected || !publishTopic) {
        console.warn('[MQTT Client] Cannot publish: Not connected or topic not set.');
        return false;
    }
    
    // Apply calibration if needed
    const calibratedMessage = applyCalibration(message);
    
    client.publish(publishTopic, calibratedMessage, { qos: 0, retain: false }, (err) => {
        if (err) {
            console.error(`[MQTT Client] Failed to publish message to topic "${publishTopic}":`, err);
        } else {
            if (calibrationString && calibratedMessage !== message) {
                console.log(`[MQTT Client] Published "${message}" (calibrated to "${calibratedMessage}") to ${publishTopic}`);
            } else {
                console.log(`[MQTT Client] Published "${message}" to ${publishTopic}`);
            }
        }
    });
    return true;
};

// Generic publish function
export const publish = (topic: string, message: string | Buffer, options?: mqtt.IClientPublishOptions): boolean => {
    if (!client || !client.connected) {
        console.warn(`[MQTT Client] Cannot publish to ${topic}: Not connected.`);
        return false;
    }
    client.publish(topic, message, options ?? { qos: 0, retain: false }, (err) => {
        if (err) {
            console.error(`[MQTT Client] Failed to publish message to topic "${topic}":`, err);
        } else {
             console.log(`[MQTT Client] Published to ${topic}`); // Simplified log
        }
    });
    return true;
};

// Subscribe function
export const subscribe = (topic: string, options?: mqtt.IClientSubscribeOptions): boolean => {
     if (!client || !client.connected) {
        console.warn(`[MQTT Client] Cannot subscribe to ${topic}: Not connected.`);
        return false;
    }
    client.subscribe(topic, options ?? { qos: 0 }, (err, granted) => {
        if (err) {
            console.error(`[MQTT Client] Failed to subscribe to topic "${topic}":`, err);
        } else {
            // Check if granted exists and has elements before accessing QoS
            const grantedQoS = (granted && granted.length > 0) ? granted[0]?.qos : 'N/A';
            console.log(`[MQTT Client] Subscribed successfully to topic "${topic}" (Granted QoS: ${grantedQoS})`);
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
