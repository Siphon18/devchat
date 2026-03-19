import { useState, useEffect } from "react";
import { getPublicProjects, joinPublicProject, sendJoinRequest } from "../services/api";
import { useToast } from "./Toast";

export default function SearchProjectsModal({ onClose, onJoin }) {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const toast = useToast();

    useEffect(() => {
        loadPublicProjects();
    }, []);

    async function loadPublicProjects() {
        setLoading(true);
        try {
            const data = await getPublicProjects();
            setProjects(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleJoin = async (projectId, isPublic) => {
        try {
            if (isPublic) {
                await joinPublicProject(projectId);
                toast.success("Successfully joined project!");
                onJoin();
                setTimeout(onClose, 1000);
            } else {
                await sendJoinRequest("project", projectId);
                toast.success("Join request sent to admins!");
            }
        } catch (e) {
            toast.error(e.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] animate-fade-in" onClick={onClose}>
            <div className="glass-panel rounded-2xl w-[calc(100vw-2rem)] max-w-[500px] max-h-[calc(100vh-4rem)] flex flex-col animate-scale-in overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-white/[0.04] flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white tracking-wide">Explore Projects</h3>
                    <button onClick={onClose} className="btn-icon">✕</button>
                </div>

                <div className="p-5 border-b border-white/[0.04]">
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </span>
                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="input-field"
                            style={{ paddingLeft: '2.5rem' }}
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                    {loading ? (
                        <div className="space-y-2 p-2">
                            <div className="skeleton skeleton-block"></div>
                            <div className="skeleton skeleton-block"></div>
                            <div className="skeleton skeleton-block"></div>
                        </div>
                    ) : filteredProjects.length === 0 ? (
                        <div className="empty-state py-8">
                            <div className="empty-state-icon">🔍</div>
                            <div className="empty-state-title">{searchQuery ? "No matches found" : "No public projects"}</div>
                            <div className="empty-state-desc">
                                {searchQuery ? "Try a different search term." : "There are no public projects available to join right now."}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredProjects.map(p => (
                                <div key={p.id} className="flex items-center justify-between p-3 glass-message rounded-xl transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl gradient-animated flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                            {p.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white">{p.name}</div>
                                            <div className="text-xs text-text-muted flex items-center gap-1.5 mt-0.5">
                                                <span className={`glass-badge text-[10px] ${p.is_public ? 'bg-accent-green/15 text-accent-green' : 'bg-yellow-500/15 text-yellow-400'}`}>
                                                    {p.is_public ? 'Public' : 'Private'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleJoin(p.id, p.is_public)}
                                        className={`text-xs py-1.5 px-4 rounded-lg font-medium transition-all ${p.is_public ? 'bg-accent-purple/15 text-accent-purple hover:bg-accent-purple hover:text-white' : 'btn-ghost text-xs'}`}
                                    >
                                        {p.is_public ? 'Join' : 'Request Access'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
