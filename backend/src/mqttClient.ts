import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import dotenv from 'dotenv';
import { SPLIT_FLAP_CHARSET } from '../shared/constants';

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

    return message.split('').map((char, position) => {
        // If character isn't in the flap sequence, return it unchanged
        if (!FLAP_SEQUENCE.includes(char)) {
            return char;
        }
        
        // Get the calibration character for this position in the display
        // If calibration string is shorter than message, wrap around
        const calibrationChar = calibrationString[position % calibrationString.length];
        
        // If calibration character isn't in the flap sequence, return original
        if (!FLAP_SEQUENCE.includes(calibrationChar)) {
            return char;
        }
        
        // Find the positions in the flap sequence
        const targetIndex = FLAP_SEQUENCE.indexOf(char);
        const calibrationIndex = FLAP_SEQUENCE.indexOf(calibrationChar);
        
        // Calculate the offset:
        // If the module shows 'A' when at home position (calibrationChar = 'A'),
        // and we want to show 'C', we need to find what character is actually
        // at position 'C' - 'A' steps in the sequence
        const offset = (targetIndex - calibrationIndex + FLAP_SEQUENCE.length) % FLAP_SEQUENCE.length;
        
        return FLAP_SEQUENCE[offset];
=======
// Function to apply calibration offsets to the display text
const applyCalibration = (text: string): string => {
    const calibrationString = process.env.CALIBRATION_STRING;
    
    // If no calibration string is provided, return the original text
    if (!calibrationString || calibrationString.trim() === '') {
        return text;
    }
    
    // Parse the calibration string into an array of offsets
    const offsets = calibrationString.split(',').map(offset => parseInt(offset.trim(), 10));
    
    // Apply the offsets to each character
    return text.split('').map((char, index) => {
        // If we don't have an offset for this position, don't change it
        if (index >= offsets.length || isNaN(offsets[index])) {
            return char;
        }
        
        // Find the character in the character set
        const charIndex = SPLIT_FLAP_CHARSET.indexOf(char);
        if (charIndex === -1) {
            return char; // Character not in set, return unchanged
        }
        
        // Apply the offset and wrap around the character set
        const newIndex = (charIndex + offsets[index] + SPLIT_FLAP_CHARSET.length) % SPLIT_FLAP_CHARSET.length;
        return SPLIT_FLAP_CHARSET[newIndex];
>>>>>>> main
    }).join('');
};

    // Apply calibration to the message
>>>>>>> main
    const calibratedMessage = applyCalibration(message);
=======
    // Apply calibration to the message
>>>>>>> main
    const calibratedMessage = applyCalibration(message);
    
             console.log(`[MQTT Client] Published "${message}" to ${publishTopic}`);
             if (message !== calibratedMessage) {
                 console.log(`[MQTT Client] Calibrated message: "${calibratedMessage}"`);
             }
>>>>>>> main
=======
             console.log(`[MQTT Client] Published "${message}" to ${publishTopic}`);
             if (message !== calibratedMessage) {
                 console.log(`[MQTT Client] Calibrated message: "${calibratedMessage}"`);
             }
>>>>>>> main
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
