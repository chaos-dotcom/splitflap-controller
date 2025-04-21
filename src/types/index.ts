export type ControlMode = 'text' | 'train' | 'sequence' | 'clock' | 'stopwatch'; // Add stopwatch mode

export interface MqttSettings {
  brokerUrl: string;
  publishTopic: string;
  subscribeTopic: string;
  username?: string;
  password?: string;
}

// Interface for a single line in a sequence
export interface SceneLine {
    id: string; // Unique ID for React keys
    text: string; // The 12-char text for the line
    durationMs?: number; // How long this line should be displayed (milliseconds)
}

// Interface for a full scene/sequence
export interface Scene {
    name: string;
    lines: SceneLine[];
    // delayMs is removed, now part of SceneLine
}

// --- Add or Ensure Departure is Exported ---
// Define the structure for departure data (matching frontend/backend)
export interface Departure {
  id: string; // Unique identifier for the service
  scheduledTime: string; // e.g., "10:30"
  destination: string; // Destination name
  platform?: string; // Platform number (optional)
  status: string; // e.g., "On time", "Delayed", "Cancelled"
  estimatedTime?: string; // Estimated time if not on time (e.g., "10:42")
}
// Interface for saved train route presets
export interface TrainRoutePreset {
    name: string; // User-defined name (e.g., "Home to Work")
    fromCRS: string; // 3-letter code
    toCRS?: string; // Optional 3-letter code
}
