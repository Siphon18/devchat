import { useEffect, useState } from "react";
import { connectWebSocket, sendMessage } from "../services/websocket";
import MessageList from "./MessageList";
import CodeEditor from "./CodeEditor";
import { getMessages } from "../services/api";
import { clearRoomMessages } from "../services/api";


export default function ChatWindow({ room, username, sidebarOpen, toggleSidebar }) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!room?.id) return;

    setMessages([]);

    async function loadHistory() {
      const history = await getMessages(room.id);
      setMessages(history);
    }

    loadHistory();

    const socket = connectWebSocket(room.id, (data) => {
      setMessages(prev => {
        const index = prev.findIndex(
          m => m.message.id === data.message.id
        );

        // If message already exists → update it
        if (index !== -1) {
          const updated = [...prev];
          updated[index] = data;
          return updated;
        }

        // Otherwise → new message
        return [...prev, data];
      });
    });

    return () => {
      socket.close();
    };
  }, [room?.id]);


  const handleSend = (type, content, language = null) => {
    sendMessage({
      sender: username,
      type,
      language,
      content
    });
  };

  return (
    <div className="flex flex-col h-full relative z-10 bg-discord-bg">
      {/* Chat Header */}
      <div className="h-12 px-4 flex items-center justify-between shadow-sm border-b border-discord-divider bg-discord-bg">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="text-discord-text-muted hover:text-discord-text-normal transition-colors"
            title={sidebarOpen ? "Close Sidebar" : "Open Sidebar"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-2xl text-discord-text-muted font-light">#</span>
            <span className="font-bold text-discord-text-normal">{room.name.toLowerCase().replace(/\s+/g, '-')}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            className="text-discord-text-muted hover:text-discord-red transition-colors"
            onClick={async () => {
              if (!window.confirm("Delete all messages in this room?")) return;
              await clearRoomMessages(room.id);
              setMessages([]);
            }}
            title="Clear Channel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 scroll-smooth custom-scrollbar flex flex-col-reverse">
        <div className="flex flex-col justify-end min-h-0">
          <MessageList messages={messages} username={username} />
        </div>
      </div>

      {/* Input Area */}
      <div className="px-4 pb-6 pt-2 bg-discord-bg">
        <CodeEditor onSend={handleSend} />
      </div>
    </div>
  );
}
