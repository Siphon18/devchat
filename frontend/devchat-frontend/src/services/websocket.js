let socket = null;
let authSent = false;

// Get WebSocket URL from environment variable
function getWebSocketUrl(roomId) {
  const apiUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  // Convert HTTP(S) URL to WS(S) URL
  const wsUrl = apiUrl.replace(/^http/, 'ws');
  return `${wsUrl}/ws/${roomId}`;
}

export function connectWebSocket(roomId, onMessage) {
  const wsUrl = getWebSocketUrl(roomId);
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    const token = localStorage.getItem("token") || "";
    if (token && !authSent) {
      socket.send(JSON.stringify({ type: "auth", token }));
      authSent = true;
    }
    console.log("WebSocket connected");
  };
  socket.onmessage = e => onMessage(JSON.parse(e.data));
  socket.onerror = e => console.error("WebSocket error", e);
  socket.onclose = (e) => {
    authSent = false;
    if (e.code === 4001) {
      console.error("WebSocket authentication failed. Token may be invalid or expired.");
    } else {
      console.log("WebSocket closed", e.code);
    }
  };

  return socket;
}

export function sendMessage(data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }
}

let lastTypingSent = 0;
export function sendTypingEvent() {
  const now = Date.now();
  if (now - lastTypingSent < 2000) return; // throttle to once per 2s
  lastTypingSent = now;
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "typing" }));
  }
}
