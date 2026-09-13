import { useEffect } from 'react';
import { api } from '../services/api';
import { socket } from '../services/socket';
import { useInboxStore } from '../store/inboxStore';
import { ConversationList } from '../components/ConversationList';
import { ChatWindow } from '../components/ChatWindow';

export function InboxPage() {
  const { conversations, selectedId, messages, setConversations, upsertConversation, select, setMessages, appendMessage } =
    useInboxStore();

  useEffect(() => {
    api.get('/conversations').then((res) => setConversations(res.data));

    socket.connect();
    socket.on('conversation:updated', upsertConversation);
    socket.on('message:new', (payload) => {
      upsertConversation(payload.conversation);
      appendMessage(payload);
    });

    return () => {
      socket.off('conversation:updated', upsertConversation);
      socket.off('message:new');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    api.get(`/conversations/${selectedId}/messages`).then((res) => setMessages(res.data));
  }, [selectedId, setMessages]);

  const selected = conversations.find((c) => c.id === selectedId) || null;

  return (
    <div className="flex h-full">
      <div className="w-80 shrink-0 border-r border-slate-200 bg-white">
        <ConversationList conversations={conversations} selectedId={selectedId} onSelect={select} />
      </div>
      <div className="flex-1 bg-white">
        <ChatWindow conversation={selected} messages={messages} />
      </div>
    </div>
  );
}
