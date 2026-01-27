import { useState, useEffect } from "react";
import ChatWindow from "./components/ChatWindow";
import RoomSidebar from "./components/RoomSidebar";

function App() {
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [username, setUsername] = useState(localStorage.getItem("username") || null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (!username) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-discord-bg font-sans">
        <div className="bg-discord-sidebar p-8 rounded-lg shadow-2xl w-96 border border-discord-server-rail">
          <div className="flex justify-center mb-6">
            <div className="w-40 h-16 rounded-[35px] bg-discord-blurple text-white flex items-center justify-center shadow-md">
              <span className="font-bold text-2xl">Dev&lt;/&gt;Chat</span>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white text-center mb-2">Welcome back!</h2>
          <p className="text-discord-text-muted text-center mb-6">We're so excited to see you again!</p>

          <form onSubmit={(e) => {
            e.preventDefault();
            const name = e.target.username.value.trim();
            if (name) {
              localStorage.setItem("username", name);
              setUsername(name);
            }
          }}>
            <div className="mb-4">
              <label className="block text-xs font-bold text-discord-text-muted uppercase mb-2">Username</label>
              <input
                name="username"
                autoFocus
                className="w-full bg-discord-server-rail text-discord-text-normal p-2.5 rounded focus:outline-none focus:ring-2 focus:ring-discord-blurple transition-all"
                placeholder="Enter your username"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-discord-blurple text-white font-medium py-2.5 rounded hover:bg-discord-blurple/80 transition-colors"
            >
              Log In
            </button>
          </form>
        </div>
      </div >
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-discord-bg font-sans">
      <RoomSidebar
        isOpen={sidebarOpen}
        onRoomSelect={setSelectedRoom}
        username={username}
        onLogout={() => {
          localStorage.removeItem("username");
          setUsername(null);
          setSelectedRoom(null);
        }}
      />

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-discord-bg relative transition-all duration-300">

        {selectedRoom ? (
          <ChatWindow
            room={selectedRoom}
            username={username}
            sidebarOpen={sidebarOpen}
            toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          />
        ) : (
          <div className="flex-1 flex flex-col relative">
            {/* Toggle Button for Empty State */}
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
              <h3 className="text-xl font-bold text-discord-text-normal mb-2">Welcome to DevChat</h3>
              <p className="max-w-md">Select a channel from the sidebar to start chatting, or create a new project!</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
