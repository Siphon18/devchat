import { useRef, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { getAvatarUrl } from "../utils/avatar";
import { getLanguageMeta } from "../config/languages";
import { fadeUp, slideDown } from "../utils/motion";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function formatTime(timestamp) {
  if (!timestamp) return "";
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    const now = Date.now();
    const diff = now - date.getTime();
    if (diff < MINUTE) return "just now";
    if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
    if (diff < DAY) return "Today at " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diff < 2 * DAY) return "Yesterday at " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function isSameUser(a, b) {
  return a?.message?.sender === b?.message?.sender;
}

function withinMinutes(a, b, mins = 5) {
  try {
    return Math.abs(new Date(a.message.timestamp) - new Date(b.message.timestamp)) < mins * 60000;
  } catch { return false; }
}

/** Show accurate avatar taking gender from the members array if possible */
function getMessageAvatarUrl(sender, currentUser, members) {
  if (sender === currentUser?.username) {
    return getAvatarUrl(currentUser.username, currentUser.gender);
  }
  const member = members.find(m => m.username === sender);
  return getAvatarUrl(sender, member?.gender || null);
}

/** Show nickname from members array if present. */
function getDisplayName(sender, currentUser, members) {
  if (sender === currentUser?.username) {
    return currentUser.nickname || currentUser.username;
  }
  const member = members.find(m => m.username === sender);
  return member?.nickname || sender;
}

function resolveUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${API_BASE}${url}`;
  return `${API_BASE}/${url}`;
}

export default function MessageList({ messages, user, members = [], onlineUsers = [], onEdit, onDelete, onReply }) {
  const bottomRef = useRef(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex flex-col gap-0.5">
      <AnimatePresence initial={false}>
      {messages.map((msg, i) => {
        const isUser = msg.message.sender === user?.username;
        const prev = messages[i - 1];
        const isGrouped = prev && isSameUser(prev, msg) && withinMinutes(prev, msg);
        return (
          <MessageBubble
            key={`${msg.message.id}-${i}`}
            msg={msg}
            isUser={isUser}
            isGrouped={isGrouped}
            index={i}
            reduceMotion={reduceMotion}
            currentUser={user}
            members={members}
            isOnline={onlineUsers.includes(msg.message.sender)}
            onEdit={onEdit}
            onDelete={onDelete}
            onReply={onReply}
          />
        );
      })}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  );
}

function MessageBubble({ msg, isUser, isGrouped, index, reduceMotion, currentUser, members, isOnline, onEdit, onDelete, onReply }) {
  const avatarUrl = getMessageAvatarUrl(msg.message.sender, currentUser, members);
  const displayName = getDisplayName(msg.message.sender, currentUser, members);
  const statusLabel = msg.execution?.status === "running"
    ? "Running"
    : msg.execution?.status === "success"
      ? "Done"
      : msg.execution?.status === "error"
        ? "Error"
        : null;

  return (
    <motion.div
      className={`message-row group/row flex gap-3 px-2 py-1 rounded-xl transition-colors animate-fade-in-up w-full ${isUser ? "flex-row-reverse" : "flex-row"} ${isGrouped ? "mt-0" : "mt-3"}`}
      style={{ animationDelay: `${Math.min(index * 0.03, 0.3)}s` }}
      variants={fadeUp}
      initial={reduceMotion || isGrouped ? false : "hidden"}
      animate="visible"
      exit="exit"
      layout={!reduceMotion}
    >
      {/* Avatar — completely hidden for current user, hidden for others when grouped */}
      {!isUser && (
        <div className="flex-shrink-0 w-10 self-end">
          {!isGrouped && (
            <div className="relative">
              <div className="w-9 h-9 rounded-full overflow-hidden border border-white/[0.08] bg-dc-panel shadow-sm">
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              </div>
              {isOnline && (
                <span className="status-dot online" />
              )}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className={`flex flex-col max-w-[88%] sm:max-w-[75%] relative ${isUser ? "items-end" : "items-start"}`}>
        {/* Header row (display name + time) - username hidden for current user */}
        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-1">
            {!isUser && (
              <span className="text-sm font-semibold text-accent-green">
                {displayName}
              </span>
            )}
            <span className="text-xs text-text-muted opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center gap-1.5">
              {formatTime(msg.message.timestamp)}
              {msg.message.is_edited && !msg.message.is_deleted && <span className="italic text-[10px] bg-white/[0.04] px-1.5 py-0.5 rounded-md">(edited)</span>}
            </span>
            {msg.message.type === "code" && statusLabel && (
              <span className={`exec-status compact ${msg.execution.status}`}>
                {statusLabel}
              </span>
            )}
          </div>
        )}

        {/* Reply Snippet */}
        {msg.message.reply_to && !msg.message.is_deleted && (
          <div className={`flex items-center gap-2 mb-1 text-xs opacity-75 max-w-[90%] ${isUser ? "justify-end mr-1" : "justify-start ml-1"}`}>
            <div className={`w-4 h-4 border-l-2 border-t-2 border-white/20 rounded-tl-lg mt-2 -ml-2 ${isUser && "scale-x-[-1]"}`} />
            <div className="reply-snippet bg-white/5 rounded-md px-2 py-1 flex items-center gap-2 truncate shadow-sm">
              <span className="font-semibold text-accent-purple shrink-0">{msg.message.reply_to.sender}</span>
              <span className="text-text-muted truncate">{msg.message.reply_to.content}</span>
            </div>
          </div>
        )}

        {/* Message body */}
        <div className={`relative flex items-center z-10 w-full ${isUser ? "justify-end" : "justify-start"}`}>

          {/* Hover action bar */}
          {!msg.message.is_deleted && (
            <div className={`message-actions ${isUser ? "!right-auto !left-3" : ""}`}>
              <button onClick={() => onReply(msg)} title="Reply">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"></polyline><path d="M20 18v-2a4 4 0 0 0-4-4H4"></path></svg>
              </button>

              {isUser && (
                <>
                  <button onClick={() => onEdit(msg)} title="Edit">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                  </button>
                  <button onClick={() => onDelete(msg.message.id)} className="danger" title="Delete">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </>
              )}
            </div>
          )}

          {msg.message.is_deleted ? (
            <div className={`
              px-4 py-2.5 rounded-2xl text-sm italic
              ${isUser
                ? "bg-transparent border border-white/[0.04] text-text-muted rounded-tr-sm"
                : "bg-transparent border border-white/[0.04] text-text-muted rounded-tl-sm"}
            `}>
              <span className="opacity-70 flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                This message was deleted.
              </span>
            </div>
          ) : msg.message.type === "code" ? (
            <CodeMessage msg={msg} isUser={isUser} />
          ) : (
            <TextMessage msg={msg} isUser={isUser} />
          )}
        </div>
      </div>
    </motion.div>
  );
}

function TextMessage({ msg, isUser }) {
  const attachments = msg.message.attachments || [];
  return (
    <div className={`message-card w-full rounded-2xl overflow-hidden shadow-sm transition-all max-w-full ${isUser
      ? "bg-accent-purple/15 border border-accent-purple/15 rounded-tr-sm"
      : "glass-message rounded-tl-sm"}`}>
      {msg.message.content && (
        <div className="px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words text-text-primary">
          {msg.message.content}
        </div>
      )}
      {attachments.length > 0 && <AttachmentBlock attachments={attachments} />}
    </div>
  );
}

function CodeMessage({ msg, isUser }) {
  const attachments = msg.message.attachments || [];
  const languageMeta = getLanguageMeta(msg.message.language);
  return (
    <div className={`code-message-card w-full rounded-2xl overflow-hidden border ${isUser ? "border-accent-purple/20 rounded-tr-sm" : "border-white/[0.06] rounded-tl-sm"}`}>
      {/* Code header */}
      <div className={`code-message-header flex items-center justify-between gap-3 px-3 py-2 text-xs font-mono ${isUser ? "bg-accent-purple/10" : "bg-dc-panel"}`}>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        </div>
        <div className="code-message-meta flex items-center gap-2 min-w-0">
          <span className="lang-badge">
            <span>{languageMeta.icon}</span>
            <span>{languageMeta.label}</span>
          </span>
          {msg.execution?.status && (
            <span className={`exec-status ${msg.execution.status}`}>
              {msg.execution.status === "running" && "Running"}
              {msg.execution.status === "success" && "Done"}
              {msg.execution.status === "error" && "Error"}
            </span>
          )}
        </div>
      </div>

      {/* Code body */}
      <pre className="code-message-body px-4 py-3 text-xs font-mono text-accent-green bg-dc-rail/80 overflow-x-auto whitespace-pre leading-relaxed">
        {msg.message.content}
      </pre>

      {/* Execution output */}
      {msg.message.type === "code" && (
        <ExecutionBlock execution={msg.execution} />
      )}
      {attachments.length > 0 && <AttachmentBlock attachments={attachments} />}
    </div>
  );
}

function AttachmentBlock({ attachments }) {
  return (
    <div className="attachment-block px-3 pb-3 space-y-2">
      {attachments.map((att, idx) => {
        const url = resolveUrl(att.url);
        const isImage = att.content_type?.startsWith("image/");
        const isAudio = att.content_type?.startsWith("audio/");

        if (isImage) {
          return (
            <a key={`${att.url}-${idx}`} href={url} target="_blank" rel="noreferrer" className="attachment-image-link block rounded-xl overflow-hidden border border-white/10 hover:border-white/30 transition-colors">
              <img src={url} alt={att.file_name} className="max-h-72 w-full object-cover" />
            </a>
          );
        }

        if (isAudio) {
          return (
            <div key={`${att.url}-${idx}`} className="attachment-audio rounded-xl border border-white/10 bg-black/20 p-2.5">
              <div className="text-[11px] text-text-muted mb-1">{att.file_name}</div>
              <audio controls className="w-full h-9">
                <source src={url} type={att.content_type || "audio/webm"} />
              </audio>
            </div>
          );
        }

        return (
          <a
            key={`${att.url}-${idx}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="attachment-file flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/20 p-2.5 hover:bg-black/30 transition-colors"
          >
            <FileAttachmentIcon className="w-5 h-5 text-accent-cyan flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-white truncate">{att.file_name}</div>
              <div className="text-[11px] text-text-muted">
                {(att.file_size / 1024).toFixed(1)} KB
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

function ExecutionBlock({ execution }) {
  if (!execution) return null;

  if (execution.status === "running") {
    return (
      <motion.div
        className="code-output-panel running"
        variants={slideDown}
        initial="hidden"
        animate="visible"
        exit="exit"
        layout
      >
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse-slow" />
        <span className="text-xs text-amber-400 font-mono">Running...</span>
        <span className="code-output-helper text-[10px] text-amber-300/70 ml-auto uppercase tracking-[0.18em]">Live</span>
      </motion.div>
    );
  }

  if (execution.status === "success" && execution.stdout) {
    return (
      <motion.div
        className="code-output-panel success"
        variants={slideDown}
        initial="hidden"
        animate="visible"
        exit="exit"
        layout
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="w-2 h-2 rounded-full bg-accent-green" />
          <span className="text-[10px] text-accent-green font-semibold uppercase tracking-wider">Output</span>
          {execution.runtime && <span className="text-[10px] text-accent-green/50 ml-auto font-mono">{execution.runtime}</span>}
        </div>
        <pre className="text-xs text-accent-green/90 font-mono whitespace-pre-wrap break-words">
          {execution.stdout}
        </pre>
      </motion.div>
    );
  }

  if (execution.status === "success" && !execution.stdout) {
    return (
      <motion.div
        className="code-output-panel success"
        variants={slideDown}
        initial="hidden"
        animate="visible"
        exit="exit"
        layout
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-accent-green" />
          <span className="text-[10px] text-accent-green font-semibold uppercase tracking-wider">Success</span>
          {execution.runtime && <span className="text-[10px] text-accent-green/50 ml-auto font-mono">{execution.runtime}</span>}
        </div>
        <span className="text-[11px] text-accent-green/50 italic">Program finished with no output.</span>
      </motion.div>
    );
  }

  if (execution.status === "error") {
    const errMsg = execution.stderr || "Unknown error";
    return (
      <motion.div
        className="code-output-panel error"
        variants={slideDown}
        initial="hidden"
        animate="visible"
        exit="exit"
        layout
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="w-2 h-2 rounded-full bg-discord-red" />
          <span className="text-[10px] text-discord-red font-semibold uppercase tracking-wider">Error</span>
          {execution.runtime && <span className="text-[10px] text-discord-red/50 ml-auto font-mono">{execution.runtime}</span>}
        </div>
        <pre className="text-xs text-discord-red/90 font-mono whitespace-pre-wrap break-words">
          {errMsg}
        </pre>
      </motion.div>
    );
  }

  return null;
}

function FileAttachmentIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v5h5" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}
