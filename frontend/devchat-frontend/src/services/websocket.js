let socket = null;

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

  socket.onopen = () => console.log("WebSocket connected");
  socket.onmessage = e => onMessage(JSON.parse(e.data));
  socket.onerror = e => console.error("WebSocket error", e);
  socket.onclose = () => console.log("WebSocket closed");

  return socket;
}

export function sendMessage(data) {
  if (socket) {
    socket.send(JSON.stringify(data));
  }
}
