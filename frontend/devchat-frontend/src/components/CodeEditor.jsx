import { useState } from "react";
import Editor from "@monaco-editor/react";

export default function CodeEditor({ onSend }) {
  const [code, setCode] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-discord-hover rounded-lg p-2.5 flex flex-col gap-2">
      {isExpanded && (
        <div className="rounded-md overflow-hidden border border-discord-divider mb-2">
          <Editor
            height="200px"
            language="python"
            theme="vs-dark"
            value={code}
            onChange={(v) => setCode(v || "")}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 14,
              padding: { top: 10, bottom: 10 },
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              backgroundColor: '#383a40',
            }}
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          className="w-6 h-6 rounded-full bg-discord-text-muted text-discord-bg flex items-center justify-center hover:text-white transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
          title="Toggle Code Editor"
        >
          <span className="font-bold text-lg leading-none mb-0.5">+</span>
        </button>

        <div className="flex-1 relative">
          {!isExpanded && (
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Message #channel"
              className="w-full bg-transparent text-discord-text-normal placeholder-discord-text-muted focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (code.trim()) onSend("text", code);
                  setCode("");
                }
              }}
            />
          )}
          {isExpanded && <div className="text-xs text-discord-text-muted font-medium">Editing Python Code...</div>}
        </div>

        <div className="flex items-center gap-2">
          {isExpanded && (
            <button
              className="text-discord-green hover:text-white p-1"
              onClick={() => onSend("code", code, "python")}
              disabled={!code.trim()}
              title="Run Code"
            >
              <span className="text-xl">▶</span>
            </button>
          )}

          <button
            className="text-discord-text-muted hover:text-discord-text-normal p-1"
            onClick={() => {
              if (code.trim()) {
                onSend(isExpanded ? "code" : "text", code, isExpanded ? "python" : null);
                setCode("");
              }
            }}
            disabled={!code.trim()}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="transform rotate-90">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
