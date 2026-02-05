export interface Conversation {
  id: string;
  subject: string;
  participants?: string[] | Array<{ name: string; email: string }>;
  lastMessageAt?: Date | string;
  preview?: string;
  is_read?: boolean;
  last_message_at?: string;
  [key: string]: any;
}

export interface EmailMessage {
  id: string;
  from?: string;
  subject?: string;
  body?: string;
  timestamp?: Date;
  from_name?: string;
  from_email?: string;
  created_at?: string;
  [key: string]: any;
}
