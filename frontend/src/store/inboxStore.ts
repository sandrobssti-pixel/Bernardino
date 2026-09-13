import { create } from 'zustand';
import { Conversation, Message } from '../types';

interface InboxState {
  conversations: Conversation[];
  selectedId: string | null;
  messages: Message[];
  setConversations: (c: Conversation[]) => void;
  upsertConversation: (c: Conversation) => void;
  select: (id: string) => void;
  setMessages: (m: Message[]) => void;
  appendMessage: (m: Message) => void;
}

export const useInboxStore = create<InboxState>((set, get) => ({
  conversations: [],
  selectedId: null,
  messages: [],
  setConversations: (conversations) => set({ conversations }),
  upsertConversation: (conversation) => {
    const exists = get().conversations.some((c) => c.id === conversation.id);
    set({
      conversations: exists
        ? get().conversations.map((c) => (c.id === conversation.id ? { ...c, ...conversation } : c))
        : [conversation, ...get().conversations],
    });
  },
  select: (id) => set({ selectedId: id, messages: [] }),
  setMessages: (messages) => set({ messages }),
  appendMessage: (message) => {
    if (message.conversationId !== get().selectedId) return;
    set({ messages: [...get().messages, message] });
  },
}));
