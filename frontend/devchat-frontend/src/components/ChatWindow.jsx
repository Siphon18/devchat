import { useEffect, useState, useRef } from "react";
import { connectWebSocket, sendMessage } from "../services/websocket";
import MessageList from "./MessageList";
import CodeEditor from "./CodeEditor";
import { getMessages, clearRoomMessages, getRoomMembers, getRoomOnline, editMessage, deleteMessage, markRoomRead } from "../services/api";

export default function ChatWindow({ room, user, sidebarOpen, toggleSidebar, onNewMessage }) {
  const username = user?.username;
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingMessage, setReplyingMessage] = useState(null);
  const prevRoomId = useRef(null);
  const typingTimers = useRef({});

  useEffect(() => {
    if (!room?.id) return;
    setMessages([]);
    setMembers([]);
    setOnlineUsers([]);
    setShowClearConfirm(false);
    setTypingUsers([]);
    setEditingMessage(null);
    setReplyingMessage(null);

    async function loadRoomData() {
      try {
        const [history, mems, onlineData] = await Promise.all([
          getMessages(room.id),
          getRoomMembers(room.id),
          getRoomOnline(room.id)
        ]);
        setMessages(Array.isArray(history) ? history : []);
        setMembers(Array.isArray(mems) ? mems : []);
        setOnlineUsers(onlineData?.online || []);
      } catch (err) {
        console.error("Failed to load room data:", err);
      }
    }
    loadRoomData();

    const socket = connectWebSocket(room.id, (data) => {
      if (data.type === "presence") {
        setOnlineUsers(data.online || []);
        return;
      }

      // Handle typing indicator
      if (data.type === "typing") {
        const typer = data.username;
        if (typer === username) return; // ignore own typing
        setTypingUsers(prev => prev.includes(typer) ? prev : [...prev, typer]);
        // Clear after 3s
        if (typingTimers.current[typer]) clearTimeout(typingTimers.current[typer]);
        typingTimers.current[typer] = setTimeout(() => {
          setTypingUsers(prev => prev.filter(u => u !== typer));
          delete typingTimers.current[typer];
        }, 3000);
        return;
      }

      // Clear typing when user sends a message
      if (data.message?.sender) {
        setTypingUsers(prev => prev.filter(u => u !== data.message.sender));
      }

      // Handle message update (edit)
      if (data.type === "message_update") {
        setMessages(prev => {
          const idx = prev.findIndex(m => m.message?.id === data.message?.id);
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], message: data.message };
            return updated;
          }
          return prev;
        });
        return;
      }

      // Handle message delete
      if (data.type === "message_delete") {
        setMessages(prev => {
          const idx = prev.findIndex(m => m.message?.id === data.message_id);
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              message: { ...updated[idx].message, is_deleted: true, content: "" }
            };
            return updated;
          }
          return prev;
        });
        return;
      }

      setMessages(prev => {
        // If it's an update to an existing message (e.g. execution output)
        if (data.message?.id) {
          const idx = prev.findIndex(m => m.message?.id === data.message.id);
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = data;
            return updated;
          }
        }
        // Otherwise it's a new message
        return [...prev, data];
      });

      // Notify parent of new message for unread badges
      if (onNewMessage && data.message?.sender !== username) {
        onNewMessage(room.id, room.project_id);
        // Mark room as read on the backend if we are actively viewing it
        markRoomRead(room.id).catch(() => { });
      }
    });

    prevRoomId.current = room.id;
    return () => {
      socket.close();
      // Clear all typing timers
      Object.values(typingTimers.current).forEach(clearTimeout);
      typingTimers.current = {};
    };
  }, [onNewMessage, room?.id, room?.project_id, username]);

  const handleSend = async (type, content, language = null, attachments = []) => {
    if (editingMessage) {
      try {
        await editMessage(editingMessage.id, content);
        setEditingMessage(null);
      } catch {
        alert("Failed to edit message");
      }
    } else {
      const payload = { sender: username, type, language, content };
      if (attachments?.length) payload.attachments = attachments;
      if (replyingMessage) {
        payload.reply_to_id = replyingMessage.id;
        setReplyingMessage(null);
      }
      sendMessage(payload);
    }
  };

  const handleDeleteMessage = async (msgId) => {
    if (confirm("Are you sure you want to delete this message for everyone?")) {
      try {
        await deleteMessage(msgId);
      } catch {
        alert("Failed to delete message");
      }
    }
  };

  const handleClear = async () => {
    try {
      setClearing(true);
      await clearRoomMessages(room.id);
      setMessages([]);
      setShowClearConfirm(false);
    } catch {
      alert("Only the room creator or an admin can clear this channel.");
      setShowClearConfirm(false);
    } finally {
      setClearing(false);
    }
  };

  const roomDisplayName = room.name.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col h-full relative bg-dc-bg">

      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-white/[0.05] flex-shrink-0 glass z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="text-text-muted hover:text-white p-1.5 rounded-lg hover:bg-dc-hover transition-all"
            title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xl font-light text-text-muted">
              {room.is_private ? <LockIcon className="w-[18px] h-[18px]" /> : "#"}
            </span>
            <span className="font-bold text-white text-sm">{roomDisplayName}</span>
            {room.projectName && (
              <span className="hidden md:block text-xs text-text-muted border-l border-white/[0.08] pl-2 ml-1">
                {room.projectName}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowClearConfirm(true)}
            className="text-text-muted hover:text-discord-red p-1.5 rounded-lg hover:bg-dc-hover transition-all"
            title="Clear channel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col-reverse">
        <div className="flex flex-col justify-end min-h-full px-4 py-4">
          {messages.length === 0 ? (
            <EmptyState roomName={roomDisplayName} />
          ) : (
            <MessageList
              messages={messages}
              user={user}
              members={members}
              onlineUsers={onlineUsers}
              onEdit={(msg) => { setEditingMessage(msg.message); setReplyingMessage(null); }}
              onDelete={(msgId) => handleDeleteMessage(msgId)}
              onReply={(msg) => { setReplyingMessage(msg.message); setEditingMessage(null); }}
            />
          )}
        </div>
      </div>

      {/* Typing indicator */}
      <div className={`px-4 transition-all duration-200 overflow-hidden ${typingUsers.length > 0 ? "h-6 opacity-100" : "h-0 opacity-0"}`}>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <div className="flex gap-0.5">
            <span className="w-1.5 h-1.5 bg-accent-purple rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-1.5 h-1.5 bg-accent-purple rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-1.5 h-1.5 bg-accent-purple rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
          <span>
            <strong className="text-white/80">{typingUsers.join(", ")}</strong>
            {typingUsers.length === 1 ? " is typing..." : " are typing..."}
          </span>
        </div>
      </div>

      {/* Input */}
      <div className="px-4 pb-5 pt-3 flex-shrink-0 border-t border-white/[0.04]">
        <CodeEditor
          onSend={handleSend}
          roomName={roomDisplayName}
          editingMessage={editingMessage}
          onCancelEdit={() => setEditingMessage(null)}
          replyingMessage={replyingMessage}
          onCancelReply={() => setReplyingMessage(null)}
        />
      </div>

      {/* Clear confirmation modal */}
      {showClearConfirm && (
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            className="glass-strong rounded-2xl p-6 w-80 animate-scale-in border border-white/[0.08]"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-xl bg-discord-red/15 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#da373c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </div>
            <h3 className="text-white font-bold text-center mb-1">Clear Channel</h3>
            <p className="text-text-secondary text-sm text-center mb-5">
              All messages in <strong>#{roomDisplayName}</strong> will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="btn-ghost flex-1 py-2.5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                disabled={clearing}
                className="flex-1 py-2.5 text-sm rounded-xl font-semibold bg-discord-red hover:bg-discord-red/80 text-white transition-all disabled:opacity-60"
              >
                {clearing ? "Clearing..." : "Clear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ roomName }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center py-16 animate-fade-in-up">
      <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center text-3xl mb-4">#</div>
      <h3 className="text-xl font-bold text-white mb-2">Welcome to #{roomName}</h3>
      <p className="text-text-secondary text-sm">This is the beginning of the channel. Say something!</p>
    </div>
  );
}

function LockIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
