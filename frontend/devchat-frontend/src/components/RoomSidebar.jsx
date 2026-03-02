import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from "react";
import {
    getProjects, getRooms, createProject, createRoom,
    deleteProject, deleteRoom, getRoomMembers, getProjectMembers, sendJoinRequest, getInviteCount, getUnreadCounts, markRoomRead, getAllUnreadCounts
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { getAvatarUrl } from "../utils/avatar";

import InboxModal from "./InboxModal";
import DirectoryModal from "./DirectoryModal";
import ManageMembersModal from "./ManageMembersModal";
import SearchProjectsModal from "./SearchProjectsModal";

function getStableDiscriminator(username) {
    const key = `devchat_disc_${username}`;
    let disc = localStorage.getItem(key);
    if (!disc) {
        disc = String(Math.floor(Math.random() * 9000) + 1000);
        localStorage.setItem(key, disc);
    }
    return disc;
}

const RoomSidebar = forwardRef(function RoomSidebar({ isOpen, onRoomSelect, onClose, username, gender, activeRoomId }, ref) {
    const [projects, setProjects] = useState([]);
    const [rooms, setRooms] = useState({});
    const [expandedProject, setExpandedProject] = useState(null);
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [isCreatingRoom, setIsCreatingRoom] = useState(false);
    const [newProjectName, setNewProjectName] = useState("");
    const [newRoomName, setNewRoomName] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);
    const [isProjectPublic, setIsProjectPublic] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [selectedRoomId, setSelectedRoomId] = useState(null);
    const [inviteCount, setInviteCount] = useState(0);
    const [unreadCounts, setUnreadCounts] = useState({}); // { roomId: count }
    const [projectUnreadCounts, setProjectUnreadCounts] = useState({}); // { projectId: count }

    // Modal states
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showInbox, setShowInbox] = useState(false);
    const [showDirectory, setShowDirectory] = useState(false);
    const [showSearchProjects, setShowSearchProjects] = useState(false);
    const [manageTarget, setManageTarget] = useState(null); // { type: 'room'|'project', id, name }

    const { user, setUser } = useAuth(); // Needed to update nickname globally
    const sidebarRef = useRef(null);

    async function loadProjects() {
        try {
            const data = await getProjects();
            if (Array.isArray(data)) setProjects(data);
        } catch (e) { console.error(e); }
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadProjects();
        const handler = () => setContextMenu(null);
        document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
    }, [activeRoomId]);

    // Poll invite count and unread counts every 30s
    useEffect(() => {
        const fetchGlobalData = async () => {
            try {
                const [inviteData, unreadData] = await Promise.all([
                    getInviteCount(),
                    getAllUnreadCounts()
                ]);
                setInviteCount(inviteData?.count || 0);

                if (unreadData && unreadData.rooms) {
                    console.log("Global unread data received:", unreadData);

                    // CRITICAL FIX: Never show unread badges for the room we are actively staring at.
                    if (activeRoomId) {
                        delete unreadData.rooms[activeRoomId];
                        delete unreadData.rooms[String(activeRoomId)];
                    }

                    setUnreadCounts(unreadData.rooms);
                    setProjectUnreadCounts(unreadData.projects || {});
                } else {
                    console.error("Failed to fetch global unread data:", unreadData);
                }
            } catch (e) {
                console.error("fetchGlobalData error:", e);
            }
        };
        fetchGlobalData();
        const interval = setInterval(fetchGlobalData, 3000); // 3 seconds for near real-time updates across rooms
        return () => clearInterval(interval);
    }, [activeRoomId]);

    useImperativeHandle(ref, () => ({
        incrementUnread: (roomId, projectId) => {
            if (activeRoomId !== roomId) {
                setUnreadCounts(prev => ({
                    ...prev,
                    [roomId]: (prev[roomId] || 0) + 1
                }));
                if (projectId) {
                    setProjectUnreadCounts(prev => ({
                        ...prev,
                        [projectId]: (prev[projectId] || 0) + 1
                    }));
                }
            }
        }
    }));

    const toggleProject = async (projectId) => {
        if (expandedProject === projectId) { setExpandedProject(null); return; }
        setExpandedProject(projectId);
        if (!rooms[projectId]) {
            try {
                const r = await getRooms(projectId);
                if (Array.isArray(r)) setRooms(p => ({ ...p, [projectId]: r }));
            } catch (e) { console.error(e); }
        }
        // Fetch unread counts when expanding
        try {
            const counts = await getUnreadCounts(projectId);
            if (counts && typeof counts === 'object') {
                setUnreadCounts(prev => ({ ...prev, ...counts }));
            }
        } catch { /* silent */ }
        setIsCreatingRoom(false);
    };

    const handleCreateProject = async () => {
        if (!newProjectName.trim()) return;
        try {
            const result = await createProject(newProjectName, isProjectPublic);
            if (result.detail) {
                console.error("Create project error:", result.detail);
                alert("Error: " + result.detail);
                return;
            }
            setNewProjectName(""); setIsCreatingProject(false); setIsProjectPublic(false);
            await loadProjects();
        } catch (err) {
            console.error("Create project failed:", err);
            alert("Failed to create project: " + err.message);
        }
    };

    const handleCreateRoom = async (projectId) => {
        if (!newRoomName.trim()) return;
        await createRoom({ name: newRoomName, project_id: projectId, is_private: isPrivate });
        setNewRoomName(""); setIsPrivate(false); setIsCreatingRoom(false);
        const updated = await getRooms(projectId);
        if (Array.isArray(updated)) setRooms(p => ({ ...p, [projectId]: updated }));
    };

    const handleContextMenu = (e, type, item) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, type, id: item.id, name: item.name, projectId: item.project_id });
    };

    const handleDelete = async () => {
        if (!contextMenu) return;

        const targetProject = projects.find(p => p.id === (contextMenu.type === "project" ? contextMenu.id : contextMenu.projectId));
        if (targetProject && user && targetProject.owner_id !== user.id) {
            alert("Whoa there, chief! 🛑 Only the mighty Project Admin wields the power to delete things here. Nice try though! 😉");
            setContextMenu(null);
            return;
        }

        if (contextMenu.type === "project") {
            if (window.confirm(`Delete project "${contextMenu.name}"?`)) {
                await deleteProject(contextMenu.id);
                await loadProjects();
                if (expandedProject === contextMenu.id) setExpandedProject(null);
            }
        } else {
            if (window.confirm(`Delete channel "#${contextMenu.name}"?`)) {
                await deleteRoom(contextMenu.id);
                const updated = await getRooms(contextMenu.projectId);
                setRooms(p => ({ ...p, [contextMenu.projectId]: updated }));
            }
        }
        setContextMenu(null);
    };

    const handleRoomSelect = async (room, projectName) => {
        if (room.is_private) {
            // First try to select it. If the backend returns 403 on getting messages, it will be handled.
            // But we don't have a pre-check here. ChatWindow handles the fetch failure.
            // Ideally we also provide a "Request Join" button if it fails.
        }
        setSelectedRoomId(room.id);
        onRoomSelect({ ...room, projectName });
        // Close sidebar on mobile after selecting a room
        if (window.innerWidth < 768) onClose?.();
        // Mark room as read and clear its badge
        try {
            await markRoomRead(room.id);
            setUnreadCounts(prev => { const n = { ...prev }; delete n[String(room.id)]; return n; });
            if (room.project_id) {
                // Since we don't return the exact decrement immediately, re-fetching global counts logic is handled via fast updates,
                // but we can locally decrement the project count
                setProjectUnreadCounts(prev => {
                    const diff = unreadCounts[room.id] || 0;
                    const result = { ...prev };
                    if (result[room.project_id]) {
                        result[room.project_id] = Math.max(0, result[room.project_id] - diff);
                    }
                    return result;
                });
            }
        } catch { /* silent */ }
    };

    const handleRequestJoin = async () => {
        if (!contextMenu) return;
        try {
            await sendJoinRequest(contextMenu.type, contextMenu.id);
            alert(`Join request sent for ${contextMenu.type} ${contextMenu.name}!`);
        } catch (e) {
            alert(`Failed: ${e.message}`);
        }
        setContextMenu(null);
    };

    return (
        <>
            {/* Mobile overlay backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden"
                    onClick={() => onClose?.()}
                />
            )}
            <aside
                ref={sidebarRef}
                className={`
          flex flex-col h-full bg-dc-sidebar border-r border-white/[0.05]
          transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden
          md:relative fixed inset-y-0 left-0 z-40
          ${isOpen ? "w-72 opacity-100" : "w-0 opacity-0 border-none"}
        `}
            >
                {/* Header */}
                <div className="px-4 py-3 border-b border-white/[0.05] flex-shrink-0 min-w-[18rem] space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="font-bold text-sm text-white tracking-wide uppercase">Projects</h2>
                        <button
                            onClick={() => setIsCreatingProject(!isCreatingProject)}
                            className="w-7 h-7 rounded-lg bg-dc-hover hover:bg-dc-active flex items-center justify-center text-text-secondary hover:text-white transition-all"
                            title="New Project"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                        </button>
                    </div>

                    <button
                        onClick={() => setShowSearchProjects(true)}
                        className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-text-secondary hover:text-white transition-colors border border-white/5"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        Explore Projects
                    </button>
                </div>

                {/* Project creator */}
                {isCreatingProject && (
                    <div className="px-3 py-2 border-b border-white/[0.05] animate-fade-in-down min-w-[18rem]">
                        <div className="flex flex-col gap-2 glass rounded-xl px-3 py-2 border border-accent-purple/30">
                            <div className="flex items-center gap-2">
                                <span className="text-accent-purple text-sm">📁</span>
                                <input
                                    autoFocus
                                    className="flex-1 bg-transparent text-sm text-white placeholder-text-muted focus:outline-none"
                                    placeholder="Project name..."
                                    value={newProjectName}
                                    onChange={e => setNewProjectName(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === "Enter") handleCreateProject();
                                        if (e.key === "Escape") setIsCreatingProject(false);
                                    }}
                                />
                            </div>
                            <div className="flex items-center justify-between text-xs text-text-secondary border-t border-white/[0.05] pt-1.5 mt-1">
                                <span className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors" onClick={() => setIsProjectPublic(!isProjectPublic)}>
                                    <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${isProjectPublic ? 'bg-accent-purple border-accent-purple' : 'border-white/20'}`}>
                                        {isProjectPublic && <svg viewBox="0 0 14 14" fill="none" className="w-2.5 h-2.5 text-white"><path d="M3 7.5L5.5 10L11 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                    </div>
                                    Public Project
                                </span>
                                <span className="text-[10px] text-text-muted">↵ to create</span>
                            </div>
                        </div>
                    </div>
                )}
                {/* Projects list */}
                <div className="flex-1 overflow-y-auto py-2 space-y-0.5 min-w-[18rem]">
                    {projects.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-center px-6 text-text-muted">
                            <div className="w-14 h-14 rounded-2xl glass flex items-center justify-center text-2xl mb-4">📂</div>
                            <p className="text-sm font-medium mb-3 text-text-secondary">No projects yet</p>
                            <button
                                onClick={() => setIsCreatingProject(true)}
                                className="btn-primary text-xs px-4 py-2"
                            >
                                Create Project
                            </button>
                        </div>
                    ) : (
                        projects.map(p => (
                            <ProjectItem
                                key={p.id}
                                project={p}
                                isExpanded={expandedProject === p.id}
                                rooms={rooms[p.id] || []}
                                isCreatingRoom={isCreatingRoom === p.id}
                                newRoomName={newRoomName}
                                isPrivate={isPrivate}
                                selectedRoomId={selectedRoomId}
                                onToggle={() => toggleProject(p.id)}
                                onCreateRoomToggle={() => {
                                    if (p.owner_id !== user?.id) {
                                        alert("Hold your horses, cowboy! 🤠 Only the grand Poobah (Admin) of this project can create new channels. No unauthorized construction allowed! 🚧");
                                        return;
                                    }
                                    setIsCreatingRoom(isCreatingRoom === p.id ? false : p.id)
                                }}
                                onRoomNameChange={v => setNewRoomName(v)}
                                onPrivateToggle={() => setIsPrivate(!isPrivate)}
                                onCreateRoom={() => handleCreateRoom(p.id)}
                                onCancelRoom={() => setIsCreatingRoom(false)}
                                onRoomSelect={(room) => handleRoomSelect(room, p.name)}
                                onContextMenu={handleContextMenu}
                                unreadCounts={unreadCounts}
                                projectUnreadCount={projectUnreadCounts[p.id] || 0}
                            />
                        ))
                    )}
                </div>

                {/* User area */}
                <div className="flex-shrink-0 p-3 border-t border-white/[0.05] min-w-[18rem]">
                    <div className="flex items-center gap-3 glass rounded-xl px-3 py-2.5 group">
                        <div className="relative flex-shrink-0">
                            <div className="w-9 h-9 rounded-full overflow-hidden border border-white/10">
                                <img src={getAvatarUrl(username, gender)} alt="avatar" className="w-full h-full object-cover" />
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-accent-green rounded-full border-2 border-dc-sidebar" />
                        </div>
                        <div className="flex-1 min-w-0 pr-2">
                            <div className="text-sm font-semibold text-white truncate">{user?.nickname || username}</div>
                            <div className="text-xs text-text-muted">#{getStableDiscriminator(username)}</div>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => setShowDirectory(true)}
                                className="text-text-muted hover:text-white p-1.5 rounded-lg hover:bg-dc-hover transition-all"
                                title="User Directory"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </button>

                            <button
                                onClick={() => setShowInbox(true)}
                                className="relative text-text-muted hover:text-white p-1.5 rounded-lg hover:bg-dc-hover transition-all"
                                title="Inbox (Invites)"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
                                </svg>
                                {inviteCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-discord-red rounded-full text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
                                        {inviteCount}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={() => setShowProfileModal(true)}
                                className="text-text-muted hover:text-white p-1.5 rounded-lg hover:bg-dc-hover transition-all"
                                title="Profile Settings"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {showInbox && <InboxModal onClose={() => setShowInbox(false)} onChange={async () => { await loadProjects(); const data = await getInviteCount(); setInviteCount(data.count || 0); }} />}
            {showDirectory && <DirectoryModal onClose={() => setShowDirectory(false)} />}
            {showSearchProjects && <SearchProjectsModal onClose={() => setShowSearchProjects(false)} onJoin={loadProjects} />}
            {manageTarget && (
                <ManageMembersModal
                    targetType={manageTarget.type}
                    targetId={manageTarget.id}
                    title={manageTarget.name}
                    getMembers={(id) => manageTarget.type === "room" ? getRoomMembers(id) : getProjectMembers(id)}
                    onClose={() => setManageTarget(null)}
                />
            )}

            {/* Profile Settings Modal */}
            {showProfileModal && (
                <ProfileSettingsModal
                    user={user}
                    onClose={() => setShowProfileModal(false)}
                    onUpdate={(newUser) => setUser(newUser)}
                />
            )}

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed glass-strong rounded-xl shadow-2xl z-[100] py-1.5 w-56 animate-scale-in border border-white/[0.08]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={e => e.stopPropagation()}
                >
                    <button
                        onClick={() => { setManageTarget({ type: contextMenu.type, id: contextMenu.id, name: contextMenu.name }); setContextMenu(null); }}
                        className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-dc-hover hover:text-white transition-colors flex items-center gap-2.5"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        Manage Members
                    </button>
                    <button
                        onClick={handleRequestJoin}
                        className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-dc-hover hover:text-white transition-colors flex items-center gap-2.5"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" /></svg>
                        Request to Join
                    </button>
                    <div className="h-px bg-white/[0.05] mx-2 my-1" />
                    <button
                        onClick={handleDelete}
                        className="w-full text-left px-3 py-2 text-sm text-discord-red hover:bg-discord-red/15 transition-colors flex items-center gap-2.5"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        Delete {contextMenu.type === "project" ? "Project" : "Channel"}
                    </button>
                </div>
            )}
        </>
    );
});

export default RoomSidebar;

function ProjectItem({
    project, isExpanded, rooms, isCreatingRoom, newRoomName, isPrivate, selectedRoomId,
    onToggle, onCreateRoomToggle, onRoomNameChange, onPrivateToggle,
    onCreateRoom, onCancelRoom, onRoomSelect, onContextMenu, unreadCounts, projectUnreadCount
}) {
    const initials = project.name.substring(0, 2).toUpperCase();
    return (
        <div className="px-2">
            {/* Project header */}
            <div
                onClick={onToggle}
                onContextMenu={e => onContextMenu(e, "project", project)}
                className={`flex items-center gap-3 px-2 py-2 rounded-xl cursor-pointer transition-all duration-200 group select-none ${isExpanded ? "bg-dc-active" : "hover:bg-dc-hover"
                    }`}
            >
                <div className={`
          w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs relative
          transition-all duration-300 flex-shrink-0 shadow-sm
          ${isExpanded
                        ? "gradient-animated"
                        : "bg-dc-active group-hover:bg-accent-purple/80"}
        `}>
                    {initials}
                    {projectUnreadCount > 0 && (
                        <div className="absolute -top-1.5 -right-1.5 bg-dc-error border-[2px] border-dc-bg text-white text-[10px] font-bold px-1.5 min-w-[20px] h-5 rounded-full flex items-center justify-center shadow-md animate-scale-in">
                            {projectUnreadCount > 99 ? "99+" : projectUnreadCount}
                        </div>
                    )}
                </div>
                <span className={`flex-1 font-semibold text-sm truncate uppercase tracking-wide transition-colors ${isExpanded ? "text-white" : "text-text-secondary group-hover:text-white"
                    }`}>
                    {project.name}
                </span>
                <svg
                    className={`w-3.5 h-3.5 text-text-muted transition-transform duration-300 flex-shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                >
                    <polyline points="9 18 15 12 9 6" />
                </svg>
            </div>

            {/* Rooms accordion */}
            <div className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                }`}>
                <div className="pl-4 pr-1 py-1 space-y-0.5">
                    {/* Create room toggle */}
                    <button
                        onClick={e => { e.stopPropagation(); onCreateRoomToggle(); }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-text-muted hover:text-white hover:bg-dc-hover rounded-lg transition-all group"
                    >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        <span className="font-medium">Add Channel</span>
                    </button>

                    {/* Room creator inline */}
                    {isCreatingRoom && (
                        <div className="px-1 pb-1 animate-fade-in-down">
                            <div className="flex items-center gap-1.5 glass rounded-lg px-2 py-1.5 border border-accent-purple/30">
                                <button
                                    onClick={onPrivateToggle}
                                    className={`text-xs px-1 rounded transition-colors ${isPrivate ? "text-accent-amber" : "text-text-muted"}`}
                                    title={isPrivate ? "Private" : "Public"}
                                >
                                    {isPrivate ? "🔒" : "#"}
                                </button>
                                <input
                                    autoFocus
                                    className="flex-1 text-xs bg-transparent text-white focus:outline-none"
                                    placeholder={isPrivate ? "private-channel" : "new-channel"}
                                    value={newRoomName}
                                    onChange={e => onRoomNameChange(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                                    onKeyDown={e => { if (e.key === "Enter") onCreateRoom(); if (e.key === "Escape") onCancelRoom(); }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Room list */}
                    {rooms.map(r => (
                        <button
                            key={r.id}
                            onClick={() => onRoomSelect(r)}
                            onContextMenu={e => onContextMenu(e, "room", r)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all duration-150 group text-left ${selectedRoomId === r.id
                                ? "bg-dc-active text-white"
                                : "text-text-muted hover:bg-dc-hover hover:text-white"
                                }`}
                        >
                            <span className={`text-sm font-light opacity-70 ${r.is_private ? "text-accent-amber" : ""}`}>
                                {r.is_private ? "🔒" : "#"}
                            </span>
                            <span className={`font-medium text-xs truncate flex-1 ${unreadCounts[String(r.id)] ? "text-white font-bold" : ""}`}>
                                {r.name.toLowerCase().replace(/\s+/g, "-")}
                            </span>
                            {unreadCounts[String(r.id)] && (
                                <span className="ml-auto bg-discord-red text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                    {unreadCounts[String(r.id)]}
                                </span>
                            )}
                        </button>
                    ))}

                    {rooms.length === 0 && !isCreatingRoom && (
                        <div className="px-2 py-1.5 text-xs text-text-muted italic">No channels yet</div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ProfileSettingsModal({ user, onClose, onUpdate }) {
    const [nickname, setNickname] = useState(user?.nickname || "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const handleSave = async (e) => {
        e.preventDefault();
        setError("");
        setSaving(true);
        try {
            const apiBase = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
            const res = await fetch(`${apiBase}/users/me`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify({ nickname: nickname.trim() })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Failed to update profile");
            }

            const updatedUser = await res.json();
            onUpdate(updatedUser);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] animate-fade-in" onClick={onClose}>
            <div className="glass-strong rounded-2xl p-6 w-[calc(100vw-2rem)] max-w-[360px] animate-scale-in border border-white/[0.08]" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-white mb-1">My Profile</h3>
                <p className="text-text-secondary text-xs mb-6">Customize how others see you in DevChat.</p>

                {/* Avatar preview */}
                <div className="flex justify-center mb-6">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-dc-panel bg-dc-bg shadow-xl">
                            <img src={getAvatarUrl(user?.username, user?.gender)} alt="avatar" className="w-full h-full object-cover" />
                        </div>
                        <span className="absolute bottom-0 right-0 w-6 h-6 bg-accent-green rounded-full border-4 border-dc-panel" title="Online" />
                    </div>
                </div>

                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Display Name (Nickname)</label>
                        <input
                            type="text"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            placeholder={user?.username}
                            maxLength={60}
                            className="input-field"
                        />
                        <p className="text-[10px] text-text-muted mt-1.5">This name will be visible to everyone in your rooms.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Username</label>
                        <input
                            type="text"
                            value={user?.username}
                            disabled
                            className="input-field opacity-50 cursor-not-allowed bg-black/20"
                        />
                        <p className="text-[10px] text-text-muted mt-1.5">You cannot change your unique username.</p>
                    </div>

                    {error && <p className="text-rose-400 text-xs mt-2">{error}</p>}

                    <div className="flex gap-3 pt-4 border-t border-white/[0.05] mt-6">
                        <button type="button" onClick={onClose} className="btn-ghost flex-1 py-2 text-sm">Cancel</button>
                        <button type="submit" disabled={saving} className="btn-primary flex-1 py-2 text-sm">
                            {saving ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
