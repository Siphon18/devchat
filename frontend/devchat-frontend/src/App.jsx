import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ChatWindow from "./components/ChatWindow";
import RoomSidebar from "./components/RoomSidebar";
import LoginPage from "./pages/LoginPage";
import { AuthProvider, useAuth } from "./context/AuthContext";

function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();
  if (loading) return <div className="flex h-screen w-screen items-center justify-center bg-discord-bg text-white">Loading...</div>;
  if (!token) return <Navigate to="/login" />;
  return children;
}

function ChatLayout() {
  const [selectedRoom, setSelectedRoom] = useState(null);
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (!user) return <div className="flex h-screen w-screen items-center justify-center bg-discord-bg text-white">Loading user data...</div>;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-discord-bg font-sans">
      <RoomSidebar
        isOpen={sidebarOpen}
        onRoomSelect={setSelectedRoom}
        username={user.username}
        onLogout={logout}
      />

      <main className="flex-1 flex flex-col min-w-0 bg-discord-bg relative transition-all duration-300">
        {selectedRoom ? (
          <ChatWindow
            room={selectedRoom}
            username={user.username}
            sidebarOpen={sidebarOpen}
            toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          />
        ) : (
          <div className="flex-1 flex flex-col relative">
            <div className="absolute top-3 left-4 z-10">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-discord-text-muted hover:text-discord-text-normal transition-colors p-1 rounded hover:bg-discord-hover/50"
                title={sidebarOpen ? "Close Sidebar" : "Open Sidebar"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-discord-text-muted p-8 text-center">
              <div className="w-16 h-16 mb-4 rounded-full bg-discord-server-rail flex items-center justify-center">
                <span className="text-4xl">👋</span>
              </div>
              <h3 className="text-xl font-bold text-discord-text-normal mb-2">Welcome to DevChat, {user.username}!</h3>
              <p className="max-w-md">Select a channel from the sidebar to start chatting, or create a new project!</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <ChatLayout />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
