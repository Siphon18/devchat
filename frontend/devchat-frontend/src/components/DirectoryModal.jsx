import { useState, useEffect } from "react";
import { searchUsers } from "../services/api";
import { getAvatarUrl } from "../utils/avatar";

export default function DirectoryModal({ onClose }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        if (query.trim().length < 2) {
            setResults([]);
            return;
        }
        const delay = setTimeout(async () => {
            setSearching(true);
            try {
                const data = await searchUsers(query);
                setResults(Array.isArray(data) ? data : []);
            } catch (e) {
                console.error(e);
            } finally {
                setSearching(false);
            }
        }, 400);
        return () => clearTimeout(delay);
    }, [query]);

    return (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] animate-fade-in" onClick={onClose}>
            <div className="glass-panel rounded-2xl p-6 w-[calc(100vw-2rem)] max-w-[450px] animate-scale-in" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">User Directory</h3>
                    <button onClick={onClose} className="btn-icon">✕</button>
                </div>

                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by username or nickname..."
                    className="input-field mb-4"
                    autoFocus
                />

                <div className="min-h-[200px] max-h-[400px] overflow-y-auto space-y-2 pr-2">
                    {searching ? (
                        <div className="space-y-3 py-2">
                            {[1,2,3].map(i => (
                                <div key={i} className="flex items-center gap-3 p-2">
                                    <div className="skeleton skeleton-avatar"></div>
                                    <div className="flex-1 space-y-2">
                                        <div className="skeleton skeleton-text short"></div>
                                        <div className="skeleton skeleton-text medium"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : results.length === 0 && query.length >= 2 ? (
                        <div className="empty-state py-6">
                            <div className="empty-state-icon">👤</div>
                            <div className="empty-state-title">No users found</div>
                            <div className="empty-state-desc">Try a different username or nickname.</div>
                        </div>
                    ) : (
                        results.map(u => (
                            <div key={u.id} className="flex items-center gap-3 p-2.5 glass-message rounded-xl group animate-fade-in-up">
                                <div className="relative flex-shrink-0">
                                    <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 bg-dc-panel">
                                        <img src={getAvatarUrl(u.username, u.gender)} alt="avatar" className="w-full h-full object-cover" />
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-white truncate">{u.nickname || u.username}</div>
                                    <div className="text-xs text-text-muted truncate">@{u.username}</div>
                                </div>
                            </div>
                        ))
                    )}
                    {query.length < 2 && (
                        <div className="empty-state py-6">
                            <div className="empty-state-icon">🔍</div>
                            <div className="empty-state-title">Search users</div>
                            <div className="empty-state-desc">Type at least 2 characters to start searching.</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
