import { useState, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ChatWindow from "./components/ChatWindow";
import RoomSidebar from "./components/RoomSidebar";
import LoginPage from "./pages/LoginPage";
import OAuthCallback from "./pages/OAuthCallback";
import LandingPage from "./pages/LandingPage";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./components/Toast";
import { getAvatarUrl } from "./utils/avatar";
import { BrandMark } from "./components/BrandMark";

function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!token) return <Navigate to="/login" />;
  return children;
}

function ChatLayout() {
  const [selectedRoom, setSelectedRoom] = useState(null);
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const sidebarRef = useRef(null);

  if (!user) return <PageLoader />;

  const handleNewMessage = (roomId, projectId) => {
    // Only increment badge if the message is from a room NOT currently being viewed
    // ChatWindow already filters out own messages before calling this
    if (sidebarRef.current?.incrementUnread) {
      sidebarRef.current.incrementUnread(roomId, projectId);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-dc-bg font-sans">
      <RoomSidebar
        ref={sidebarRef}
        isOpen={sidebarOpen}
        onRoomSelect={setSelectedRoom}
        onClose={() => setSidebarOpen(false)}
        username={user.username}
        gender={user.gender}
        activeRoomId={selectedRoom?.id}
      />

      <main className="flex-1 flex flex-col min-w-0 bg-dc-bg relative transition-all duration-300">
        {selectedRoom ? (
          <ChatWindow
            room={selectedRoom}
            user={user}
            sidebarOpen={sidebarOpen}
            toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            onNewMessage={handleNewMessage}
          />
        ) : (
          <WelcomeScreen user={user} sidebarOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        )}
      </main>
    </div>
  );
}


function WelcomeScreen({ user, sidebarOpen, toggleSidebar }) {
  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      {/* Sidebar toggle */}
      <div className="absolute top-4 left-4 z-10">
        <button
          onClick={toggleSidebar}
          className="text-text-muted hover:text-white transition-colors p-2 rounded-lg hover:bg-dc-hover"
          title={sidebarOpen ? "Close Sidebar" : "Open Sidebar"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>
      </div>

      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="orb w-80 h-80 bg-[#5865F2] top-1/4 left-1/4 opacity-10" />
        <div className="orb w-64 h-64 bg-[#7c3aed] bottom-1/4 right-1/4 opacity-10" style={{ animationDelay: "3s" }} />
      </div>

      {/* Welcome content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative z-10">
        <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl mb-6 animate-scale-in">
          <img src={getAvatarUrl(user.username, user.gender)} alt="Avatar" className="w-full h-full object-cover" />
        </div>
        <h2 className="text-3xl font-black text-white mb-2 animate-fade-in-up">
          Welcome, <span className="gradient-text">{user.username}</span>!
        </h2>
        <p className="text-text-secondary max-w-sm animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          Select a channel from the sidebar to start chatting, or create a new project.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-8 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <div className="glass rounded-xl px-4 py-2.5 text-xs text-text-secondary">⚡ Real-time chat</div>
          <div className="glass rounded-xl px-4 py-2.5 text-xs text-text-secondary">🐍 Python execution</div>
          <div className="glass rounded-xl px-4 py-2.5 text-xs text-text-secondary">🔒 Private rooms</div>
        </div>
      </div>
    </div>
  );
}

function PageLoader() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-dc-bg">
      {/* Subtle background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="orb w-96 h-96 bg-[#5865F2] top-1/3 left-1/3 opacity-[0.06]" />
      </div>
        <div className="flex flex-col items-center gap-4 relative z-10">
        <BrandMark className="h-14 w-14 animate-pulse-slow" />
        <div className="flex items-center gap-2">
          <div className="typing-dot" style={{ background: '#5865F2' }}></div>
          <div className="typing-dot" style={{ background: '#7c3aed', animationDelay: '0.15s' }}></div>
          <div className="typing-dot" style={{ background: '#06b6d4', animationDelay: '0.3s' }}></div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/oauth/callback" element={<OAuthCallback />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <ChatLayout />
                </ProtectedRoute>
              }
            />
            {/* Legacy redirect */}
            <Route path="/*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
