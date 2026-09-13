export type Role = 'ADMIN' | 'AGENT';
export type ConversationStatus = 'OPEN' | 'PENDING' | 'CLOSED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'ONLINE' | 'OFFLINE';
}

export interface Contact {
  id: string;
  name: string | null;
  phone: string;
  whatsappJid: string;
  avatarUrl: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  senderType: 'CONTACT' | 'AGENT' | 'SYSTEM';
  content: string | null;
  status: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  status: ConversationStatus;
  contact: Contact;
  assignedAgent: { id: string; name: string } | null;
  queue: { id: string; name: string } | null;
  lastMessageAt: string | null;
  messages?: Message[];
}
