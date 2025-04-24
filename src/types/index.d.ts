export type ControlMode = 'text' | 'train' | 'sequence' | 'clock' | 'stopwatch' | 'timer';
export interface MqttSettings {
    brokerUrl: string;
    publishTopic: string;
    subscribeTopic: string;
    username?: string;
    password?: string;
}
export interface SceneLine {
    id: string;
    text: string;
    durationMs?: number;
}
export interface Scene {
    name: string;
    lines: SceneLine[];
    loop?: boolean;
}
export interface Departure {
    id: string;
    scheduledTime: string;
    destination: string;
    platform?: string;
    status: string;
    estimatedTime?: string;
    destinationETA?: string;
}
export interface TrainRoutePreset {
    name: string;
    fromCRS: string;
    toCRS?: string;
}
