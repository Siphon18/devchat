import { useEffect, useState, useRef } from "react";
import { getProjects, getRooms, createProject, createRoom, deleteProject, deleteRoom } from "../services/api";

export default function RoomSidebar({ isOpen, onRoomSelect, username, onLogout }) {
    const [projects, setProjects] = useState([]);
    const [rooms, setRooms] = useState({}); // Map project ID to rooms
    const [expandedProject, setExpandedProject] = useState(null);

    // UI States for creation
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [isCreatingRoom, setIsCreatingRoom] = useState(false);
    const [newProjectName, setNewProjectName] = useState("");
    const [newRoomName, setNewRoomName] = useState("");

    // Context Menu State
    const [contextMenu, setContextMenu] = useState(null); // { x, y, type, id, name }
    const sidebarRef = useRef(null);

    useEffect(() => {
        loadProjects();

        const handleClickOutside = () => setContextMenu(null);
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, []);

    const loadProjects = async () => {
        const data = await getProjects();
        setProjects(data);
    };

    const toggleProject = async (projectId) => {
        if (expandedProject === projectId) {
            setExpandedProject(null);
            return;
        }

        setExpandedProject(projectId);
        // Load rooms for this project if not already loaded
        if (!rooms[projectId]) {
            const projectRooms = await getRooms(projectId);
            setRooms(prev => ({ ...prev, [projectId]: projectRooms }));
        }
        setIsCreatingRoom(false);
    };

    const handleCreateProject = async () => {
        if (!newProjectName.trim()) return;
        await createProject({ name: newProjectName });
        setNewProjectName("");
        setIsCreatingProject(false);
        await loadProjects();
    };

    const handleCreateRoom = async (projectId) => {
        if (!newRoomName.trim()) return;
        await createRoom({ name: newRoomName, project_id: projectId });
        setNewRoomName("");
        setIsCreatingRoom(false);
        const updated = await getRooms(projectId);
        setRooms(prev => ({ ...prev, [projectId]: updated }));
    };

    const handleContextMenu = (e, type, item) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            type,
            id: item.id,
            name: item.name,
            projectId: item.project_id // for rooms
        });
    };

    const handleDelete = async () => {
        if (!contextMenu) return;

        if (contextMenu.type === 'project') {
            if (window.confirm(`Delete project "${contextMenu.name}"?`)) {
                await deleteProject(contextMenu.id);
                await loadProjects();
                if (expandedProject === contextMenu.id) setExpandedProject(null);
            }
        } else if (contextMenu.type === 'room') {
            if (window.confirm(`Delete channel "#${contextMenu.name}"?`)) {
                await deleteRoom(contextMenu.id);
                const updated = await getRooms(contextMenu.projectId);
                setRooms(prev => ({ ...prev, [contextMenu.projectId]: updated }));
            }
        }
        setContextMenu(null);
    };

    return (
        <aside
            className={`
                bg-discord-sidebar flex flex-col h-full border-r border-discord-bg/20 relative transition-all duration-300 ease-in-out overflow-hidden
                ${isOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 border-none'}
            `}
            ref={sidebarRef}
        >
            {/* Header / Add Project */}
            <div className="h-12 px-4 flex items-center justify-between shadow-sm border-b border-discord-divider bg-discord-sidebar hover:bg-discord-hover/10 transition-colors min-w-[18rem]">
                <h2 className="font-bold text-discord-text-normal truncate">Projects</h2>
                <button
                    onClick={() => setIsCreatingProject(!isCreatingProject)}
                    className="text-discord-text-muted hover:text-discord-text-normal transition-colors"
                    title="Create Project"
                >
                    <span className="text-xl leading-none">+</span>
                </button>
            </div>

            {/* Inline Project Creator */}
            {isCreatingProject && (
                <div className="px-2 py-2 bg-discord-server-rail/30 border-b border-discord-divider animate-fade-in-up min-w-[18rem]">
                    <input
                        autoFocus
                        className="w-full bg-discord-bg text-discord-text-normal text-sm px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-discord-blurple"
                        placeholder="New Project Name..."
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateProject();
                            if (e.key === 'Escape') setIsCreatingProject(false);
                        }}
                        onBlur={() => {
                            if (!newProjectName) setIsCreatingProject(false);
                        }}
                    />
                </div>
            )}

            {/* Project List (Accordion) */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 min-w-[18rem]">
                {projects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-center p-4 text-discord-text-muted opacity-80 hover:opacity-100 transition-opacity border-2 border-dashed border-discord-bg/30 rounded-lg m-2">
                        <div className="w-12 h-12 rounded-full bg-discord-bg flex items-center justify-center mb-3">
                            <span className="text-2xl">📂</span>
                        </div>
                        <p className="text-sm font-medium mb-3">No projects yet</p>
                        <button
                            onClick={() => setIsCreatingProject(true)}
                            className="text-xs bg-discord-blurple text-white px-4 py-2 rounded hover:bg-discord-blurple-hover transition-colors font-medium"
                        >
                            Create Project
                        </button>
                    </div>
                ) : (
                    projects.map((p) => (
                        <div key={p.id} className="select-none">
                            {/* Project Header with Circular Icon */}
                            <div
                                onClick={() => toggleProject(p.id)}
                                onContextMenu={(e) => handleContextMenu(e, 'project', p)}
                                className={`
                                    flex items-center gap-3 px-2 py-2 rounded cursor-pointer transition-all duration-200 group
                                    ${expandedProject === p.id ? 'bg-discord-hover/50' : 'hover:bg-discord-hover'}
                                `}
                            >
                                {/* Circular Icon */}
                                <div className={`
                                    w-10 h-10 rounded-[20px] flex items-center justify-center text-white font-bold text-sm transition-all duration-300 shadow-sm
                                    ${expandedProject === p.id ? 'bg-discord-blurple rounded-[12px]' : 'bg-discord-server-rail group-hover:bg-discord-blurple group-hover:rounded-[12px]'}
                                `}>
                                    {p.name.substring(0, 2).toUpperCase()}
                                </div>

                                <div className="flex-1 min-w-0 flex items-center justify-between">
                                    <span className={`font-bold text-sm truncate uppercase tracking-wide ${expandedProject === p.id ? 'text-discord-text-normal' : 'text-discord-text-muted group-hover:text-discord-text-normal'}`}>
                                        {p.name}
                                    </span>
                                    <svg
                                        className={`w-4 h-4 transform transition-transform duration-200 text-discord-text-muted ${expandedProject === p.id ? 'rotate-90' : ''}`}
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                </div>
                            </div>

                            {/* Rooms List (Collapsible) */}
                            <div className={`
                                overflow-hidden transition-all duration-300 ease-in-out pl-4
                                ${expandedProject === p.id ? 'max-h-[500px] opacity-100 mt-1' : 'max-h-0 opacity-0'}
                            `}>
                                <div className="pl-2 border-l-2 border-discord-bg/30 space-y-[2px] py-1">
                                    {/* Add Room Button */}
                                    <div
                                        className="flex items-center justify-between px-2 py-1 group cursor-pointer text-discord-text-muted hover:text-discord-text-normal rounded hover:bg-discord-hover/50"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsCreatingRoom(isCreatingRoom === p.id ? false : p.id);
                                        }}
                                    >
                                        <span className="text-xs font-medium hover:underline">Create Channel</span>
                                        <span className="text-lg leading-none opacity-0 group-hover:opacity-100">+</span>
                                    </div>

                                    {/* Inline Room Creator */}
                                    {isCreatingRoom === p.id && (
                                        <div className="px-2 mb-1 animate-fade-in-up">
                                            <div className="bg-discord-server-rail rounded p-1 flex items-center border border-discord-blurple">
                                                <span className="text-discord-text-muted px-1">#</span>
                                                <input
                                                    autoFocus
                                                    className="w-full bg-transparent text-discord-text-normal text-sm focus:outline-none"
                                                    placeholder="new-channel"
                                                    value={newRoomName}
                                                    onChange={(e) => setNewRoomName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCreateRoom(p.id);
                                                        if (e.key === 'Escape') setIsCreatingRoom(false);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Rooms */}
                                    {rooms[p.id]?.map((r) => (
                                        <div
                                            key={r.id}
                                            onClick={() => onRoomSelect({ ...r, projectName: p.name })}
                                            onContextMenu={(e) => handleContextMenu(e, 'room', r)}
                                            className="
                                                group flex items-center px-2 py-[5px] rounded cursor-pointer transition-colors
                                                text-discord-text-muted hover:bg-discord-hover hover:text-discord-text-normal
                                            "
                                        >
                                            <span className="text-lg mr-1.5 text-discord-text-muted opacity-70">#</span>
                                            <span className="font-medium text-sm truncate">{r.name.toLowerCase().replace(/\s+/g, '-')}</span>
                                        </div>
                                    ))}
                                    {rooms[p.id]?.length === 0 && (
                                        <div className="px-2 py-1 text-xs text-discord-text-muted italic">No channels yet</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* User Area */}
            <div className="bg-discord-server-rail/30 p-2 flex items-center gap-2 group border-t border-discord-bg/20 min-w-[18rem]">
                <div className="w-8 h-8 rounded-full bg-discord-blurple flex items-center justify-center text-sm font-bold text-white relative">
                    {username ? username.substring(0, 1).toUpperCase() : 'U'}
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-discord-green rounded-full border-2 border-discord-server-rail"></div>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-discord-text-normal truncate">{username || 'User'}</div>
                    <div className="text-xs text-discord-text-muted truncate">#{Math.floor(Math.random() * 9000) + 1000}</div>
                </div>
                <button
                    onClick={onLogout}
                    className="text-discord-text-muted hover:text-discord-text-normal p-1 rounded hover:bg-discord-hover transition-colors"
                    title="Log Out"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                </button>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed bg-[#111214] border border-discord-bg rounded shadow-2xl z-50 py-1 w-48 animate-fade-in"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={handleDelete}
                        className="w-full text-left px-3 py-2 text-sm text-discord-red hover:bg-discord-red hover:text-white transition-colors flex items-center justify-between group"
                    >
                        <span>Delete {contextMenu.type === 'project' ? 'Project' : 'Channel'}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            )}
        </aside>
    );
}
