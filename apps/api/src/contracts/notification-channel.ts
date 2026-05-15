export interface NotificationMessage {
  to: string;
  subject?: string;
  body: string;
}

export interface NotificationChannel {
  readonly name: string;
  send(message: NotificationMessage): Promise<void>;
}

