export default function MessageList({ messages, username }) {
  const formatTime = (timestamp) => {
    if (!timestamp) return "Just now";
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return "Just now";
      return "Today at " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return "Just now";
    }
  };

  return (
    <div className="flex flex-col gap-[17px] py-4">
      {messages.map((msg, i) => {
        const isUser = msg.message.sender === username;
        // Check if previous message was from same user within short time (grouping) - simplified for now
        const showHeader = true;

        return (
          <div
            key={i}
            className={`flex gap-4 px-2 py-0.5 hover:bg-discord-hover/30 -mx-4 px-4 group animate-fade-in-up ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            {/* Avatar */}
            <div className="flex-shrink-0 mt-0.5 cursor-pointer">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm overflow-hidden transition-opacity hover:opacity-80
                ${isUser ? 'bg-discord-blurple' : 'bg-discord-green'}
              `}>
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.message.sender}`} alt="avatar" className="w-full h-full" />
              </div>
            </div>

            {/* Content */}
            <div className={`flex-1 min-w-0 flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              {showHeader && (
                <div className={`flex items-center gap-2 mb-1 ${isUser ? 'flex-row-reverse' : ''}`}>
                  <span className={`font-medium cursor-pointer hover:underline ${isUser ? 'text-discord-blurple' : 'text-discord-green'}`}>
                    {msg.message.sender}
                  </span>
                  <span className="text-xs text-discord-text-muted">{formatTime(msg.message.timestamp)}</span>
                </div>
              )}

              <div className={`
                whitespace-pre-wrap break-words leading-[1.375rem] w-fit max-w-[85%] px-4 py-2.5 rounded-2xl shadow-sm border
                ${isUser
                  ? 'bg-discord-blurple/10 border-discord-blurple/20 text-discord-text-normal rounded-tr-none'
                  : 'bg-discord-server-rail border-transparent text-discord-text-normal rounded-tl-none'}
              `}>
                {msg.message.content}
              </div>

              {/* Execution state handling */}
              {msg.message.type === "code" && (
                <div className={`mt-2 w-full max-w-[85%] ${isUser ? 'text-right' : 'text-left'}`}>
                  {msg.execution?.status === "running" && (
                    <div className="exec running">⏳ Running...</div>
                  )}

                  {msg.execution?.status === "success" && (
                    <div className="exec success text-left">
                      <pre className="whitespace-pre-wrap break-words">{msg.execution.stdout}</pre>
                    </div>
                  )}

                  {msg.execution?.status === "error" && (
                    <div className="exec error text-left">
                      <pre className="whitespace-pre-wrap break-words">{msg.execution.stderr}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
