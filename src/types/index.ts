export type ControlMode = 'text' | 'train'; // Add more modes later

export interface MqttSettings {
  brokerUrl: string;
  publishTopic: string;
  subscribeTopic: string;
  username?: string;
  password?: string;
}
