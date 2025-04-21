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
