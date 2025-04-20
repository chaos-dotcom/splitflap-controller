export type ControlMode = 'text' | 'train' | 'sequence'; // Add sequence mode

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
    text: string;
}

// Interface for a full scene/sequence
export interface Scene {
    name: string;
    lines: SceneLine[];
    delayMs: number; // Delay between lines in milliseconds
}
