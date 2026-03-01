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
        }, 400); // debounce
        return () => clearTimeout(delay);
    }, [query]);

    return (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] animate-fade-in" onClick={onClose}>
            <div className="glass-strong rounded-2xl p-6 w-[450px] animate-scale-in border border-white/[0.08]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">User Directory</h3>
                    <button onClick={onClose} className="text-text-muted hover:text-white p-1 rounded-lg hover:bg-dc-hover">✕</button>
                </div>

                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by username or nickname..."
                    className="input-field mb-4"
                    autoFocus
                />

                <div className="min-h-[200px] max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {searching ? (
                        <div className="text-center text-text-muted py-4">Searching...</div>
                    ) : results.length === 0 && query.length >= 2 ? (
                        <div className="text-center text-text-muted py-4 italic">No users found.</div>
                    ) : (
                        results.map(u => (
                            <div key={u.id} className="flex items-center gap-3 p-2 hover:bg-dc-hover transition-colors rounded-lg group">
                                <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 flex-shrink-0 bg-dc-panel">
                                    <img src={getAvatarUrl(u.username, u.gender)} alt="avatar" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-white truncate">{u.nickname || u.username}</div>
                                    <div className="text-xs text-text-muted truncate">@{u.username}</div>
                                </div>
                            </div>
                        ))
                    )}
                    {query.length < 2 && (
                        <div className="text-center text-text-muted py-4 italic text-sm">
                            Type at least 2 characters to search.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
