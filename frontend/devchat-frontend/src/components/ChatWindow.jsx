import { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { connectWebSocket, sendMessage } from "../services/websocket";
import MessageList from "./MessageList";
import CodeEditor from "./CodeEditor";
import { useToast } from "./Toast";
import { getMessages, clearRoomMessages, getRoomMembers, getRoomOnline, editMessage, deleteMessage, markRoomRead } from "../services/api";
import { fade, fadeUp, scaleIn } from "../utils/motion";

export default function ChatWindow({ room, user, sidebarOpen, toggleSidebar, onNewMessage }) {
  const username = user?.username;
  const toast = useToast();
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
  const reduceMotion = useReducedMotion();

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
        // Deduplicate: don't append if this message ID already exists
        if (data.message?.id && prev.some(m => m.message?.id === data.message.id)) {
          return prev;
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

  const handleSend = async (type, content, language = null, attachments = [], stdinText = "") => {
    if (editingMessage) {
      try {
        await editMessage(editingMessage.id, content);
        setEditingMessage(null);
      } catch {
        toast.error("Failed to edit message");
      }
    } else {
      const payload = { sender: username, type, language, content };
      if (stdinText) payload.stdin = stdinText;
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
        toast.error("Failed to delete message");
      }
    }
  };

  const handleClear = async () => {
    try {
      setClearing(true);
      await clearRoomMessages(room.id);
      setMessages([]);
      setShowClearConfirm(false);
      toast.success("Channel cleared successfully");
    } catch {
      toast.error("Only the room creator or an admin can clear this channel.");
      setShowClearConfirm(false);
    } finally {
      setClearing(false);
    }
  };

  const roomDisplayName = room.name.toLowerCase().replace(/\s+/g, "-");
  const totalMessages = messages.length;
  const roomKindLabel = room.is_private ? "Private channel" : "Open channel";

  return (
    <div className="chat-workspace flex flex-col h-full relative bg-dc-bg">
      <div className="chat-workspace-glow" />

      {/* Header — glass panel */}
      <motion.div
        key={`room-header-${room.id}`}
        className="chat-room-header flex-shrink-0 z-10"
        variants={fadeUp}
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
      >
        <div className="chat-room-header-row">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={toggleSidebar}
              className="btn-icon"
              title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl font-light text-text-muted flex-shrink-0">
                {room.is_private ? <LockIcon className="w-[18px] h-[18px]" /> : "#"}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span className="font-bold text-white text-sm truncate">{roomDisplayName}</span>
                  <span className="chat-room-chip">{roomKindLabel}</span>
                  {room.projectName && (
                    <span className="chat-room-chip subtle">{room.projectName}</span>
                  )}
                </div>
                <div className="chat-room-subtitle">
                  Live collaboration space with code execution, replies, and room presence.
                </div>
              </div>
            </div>
          </div>

          <div className="chat-room-metrics">
            <div className="chat-room-stat">
              <span className="chat-room-stat-label">Online</span>
              <span className="chat-room-stat-value text-accent-green">{onlineUsers.length}</span>
            </div>
            <div className="chat-room-stat hidden sm:flex">
              <span className="chat-room-stat-label">Messages</span>
              <span className="chat-room-stat-value">{totalMessages}</span>
            </div>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="btn-icon hover:!text-discord-red"
              title="Clear channel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Messages */}
      <motion.div
        key={`thread-${room.id}`}
        className="chat-thread-shell flex-1 overflow-y-auto flex flex-col-reverse"
        variants={fade}
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
      >
        <div className="chat-thread-content flex flex-col justify-end min-h-full px-4 py-4">
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
      </motion.div>

      {/* Typing indicator — bouncing dots */}
      <div className="px-4">
        <AnimatePresence initial={false}>
          {typingUsers.length > 0 && (
            <motion.div
              className="chat-typing-bar"
              variants={fadeUp}
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              exit="exit"
            >
              <div className="typing-indicator">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
              <span className="text-xs text-text-muted">
                <strong className="text-white/80">{typingUsers.join(", ")}</strong>
                {typingUsers.length === 1 ? " is typing" : " are typing"}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input — glass wrapper */}
      <div className="chat-composer-wrap px-4 pb-5 pt-3 flex-shrink-0">
        <div className="chat-composer-shell glass-input rounded-2xl">
          <CodeEditor
            onSend={handleSend}
            roomName={roomDisplayName}
            editingMessage={editingMessage}
            onCancelEdit={() => setEditingMessage(null)}
            replyingMessage={replyingMessage}
            onCancelReply={() => setReplyingMessage(null)}
          />
        </div>
      </div>

      {/* Clear confirmation modal — glass panel */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowClearConfirm(false)}
            variants={fade}
            initial={reduceMotion ? false : "hidden"}
            animate="visible"
            exit="exit"
          >
            <motion.div
              className="glass-panel rounded-2xl p-6 w-[calc(100vw-3rem)] max-w-80"
              onClick={e => e.stopPropagation()}
              variants={scaleIn}
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              exit="exit"
            >
            <div className="w-12 h-12 rounded-xl bg-discord-red/10 border border-discord-red/15 flex items-center justify-center mx-auto mb-4">
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ roomName }) {
  return (
    <div className="empty-state flex-1 animate-fade-in-up">
      <div className="empty-state-icon">
        #
      </div>
      <div className="empty-state-title">Welcome to #{roomName}</div>
      <div className="empty-state-desc">
        This is the very beginning of the channel. Start the conversation!
      </div>
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
