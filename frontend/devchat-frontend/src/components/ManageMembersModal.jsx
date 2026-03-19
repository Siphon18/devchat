import { useState, useEffect, useCallback } from "react";
import { getRequests, respondToRequest, sendInvite, searchUsers } from "../services/api";
import { getAvatarUrl } from "../utils/avatar";
import { useToast } from "./Toast";

export default function ManageMembersModal({ targetType, targetId, title, getMembers, onClose }) {
    const toast = useToast();
    const [tab, setTab] = useState("members"); // "members" | "requests"
    const [members, setMembers] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    const [inviteUser, setInviteUser] = useState("");
    const [inviteMsg, setInviteMsg] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            if (tab === "members") {
                const data = await getMembers(targetId);
                setMembers(Array.isArray(data) ? data : []);
            } else {
                const data = await getRequests(targetType, targetId);
                setRequests(Array.isArray(data) ? data : []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [getMembers, tab, targetId, targetType]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        if (inviteUser.trim().length < 2 || !showDropdown) {
            setSearchResults([]);
            return;
        }
        const delay = setTimeout(async () => {
            setIsSearching(true);
            try {
                const data = await searchUsers(inviteUser);
                setSearchResults(Array.isArray(data) ? data : []);
            } catch (e) {
                console.error(e);
            } finally {
                setIsSearching(false);
            }
        }, 300);
        return () => clearTimeout(delay);
    }, [inviteUser, showDropdown]);

    const handleAction = async (id, action) => {
        try {
            await respondToRequest(id, action);
            await loadData();
            toast.success(action === "approve" ? "Request approved" : "Request denied");
        } catch (e) {
            toast.error(e.message);
        }
    };

    const handleSendInvite = async (e) => {
        e.preventDefault();
        setInviteMsg("");
        if (!inviteUser.trim()) return;
        try {
            await sendInvite(targetType, targetId, inviteUser.trim());
            setInviteMsg(`✓ Invite sent successfully!`);
            setInviteUser("");
        } catch (e) {
            setInviteMsg(`❌ ${e.message}`);
        }
    };

    return (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] animate-fade-in" onClick={onClose}>
            <div className="glass-strong rounded-2xl w-[calc(100vw-2rem)] max-w-[500px] h-[calc(100vh-4rem)] max-h-[600px] flex flex-col animate-scale-in border border-white/[0.08] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-white/[0.05] flex justify-between items-center bg-black/20">
                    <h3 className="text-xl font-bold text-white tracking-wide truncate">Manage {title}</h3>
                    <button onClick={onClose} className="text-text-muted hover:text-white p-1 rounded-lg hover:bg-dc-hover ml-4 flex-shrink-0">✕</button>
                </div>

                <div className="flex px-5 pt-3 border-b border-white/[0.05] gap-4 text-sm font-semibold">
                    <button
                        onClick={() => setTab("members")}
                        className={`pb-3 border-b-2 transition-colors ${tab === "members" ? "border-accent-purple text-white" : "border-transparent text-text-muted hover:text-white"}`}
                    >
                        Members
                    </button>
                    <button
                        onClick={() => setTab("requests")}
                        className={`pb-3 border-b-2 transition-colors ${tab === "requests" ? "border-accent-purple text-white" : "border-transparent text-text-muted hover:text-white"}`}
                    >
                        Join Requests
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                    {loading ? (
                        <div className="text-center text-text-muted py-8">Loading...</div>
                    ) : tab === "members" ? (
                        <div className="space-y-4">
                            <form onSubmit={handleSendInvite} className="mb-6 p-4 rounded-xl bg-black/20 border border-white/[0.05] relative">
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Send Invite</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Username"
                                        value={inviteUser}
                                        onChange={e => { setInviteUser(e.target.value); setShowDropdown(true); setInviteMsg(""); }}
                                        onFocus={() => setShowDropdown(true)}
                                        className="input-field"
                                    />
                                    <button type="submit" className="btn-primary px-4 bg-accent-purple hover:bg-accent-indigo">Invite</button>
                                </div>
                                {inviteMsg && <p className={`text-xs mt-2 ${inviteMsg.startsWith("✓") ? "text-accent-green" : "text-discord-red"}`}>{inviteMsg}</p>}

                                {showDropdown && inviteUser.trim().length >= 2 && (
                                    <div className="absolute top-16 left-4 right-24 bg-dc-active border border-white/10 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                                        {isSearching ? (
                                            <div className="p-3 text-xs text-text-muted text-center">Searching...</div>
                                        ) : searchResults.length === 0 ? (
                                            <div className="p-3 text-xs text-text-muted text-center">No users found.</div>
                                        ) : (
                                            searchResults.map(u => (
                                                <div
                                                    key={u.id}
                                                    className="p-2 flex items-center gap-3 cursor-pointer hover:bg-dc-hover transition-colors border-b border-white/[0.02] last:border-0"
                                                    onClick={() => {
                                                        setInviteUser(u.username);
                                                        setShowDropdown(false);
                                                    }}
                                                >
                                                    <div className="w-6 h-6 rounded-full overflow-hidden bg-dc-panel flex-shrink-0">
                                                        <img src={getAvatarUrl(u.username, u.gender)} alt="avatar" className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-xs font-semibold text-white truncate">{u.nickname || u.username}</div>
                                                        <div className="text-[10px] text-text-muted">@{u.username}</div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </form>

                            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Current Members ({members.length})</h4>
                            <div className="space-y-2">
                                {members.map((m, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-2 rounded-lg hover:bg-white/[0.02]">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 bg-dc-panel flex-shrink-0">
                                                <img src={getAvatarUrl(m.username, m.gender)} alt="avatar" className="w-full h-full object-cover" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium text-white flex items-center gap-2 truncate">
                                                    {m.nickname || m.username}
                                                    {m.role === "admin" && <span className="bg-accent-indigo text-white text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Admin</span>}
                                                </div>
                                                <div className="text-xs text-text-muted truncate">@{m.username}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {requests.length === 0 ? (
                                <div className="text-center text-text-muted py-8 italic text-sm">No pending requests.</div>
                            ) : requests.map(req => (
                                <div key={req.id} className="flex justify-between items-center p-3 bg-black/20 rounded-lg border border-white/[0.05]">
                                    <div className="text-sm min-w-0 mr-4">
                                        <div className="font-medium text-white truncate">@{req.username}</div>
                                        <div className="text-xs text-text-muted">wants to join</div>
                                    </div>
                                    <div className="flex gap-2 flex-shrink-0">
                                        <button onClick={() => handleAction(req.id, "approve")} className="btn-primary py-1.5 px-3 text-xs">Approve</button>
                                        <button onClick={() => handleAction(req.id, "deny")} className="btn-ghost py-1.5 px-3 text-xs text-discord-red  hover:bg-discord-red/10 border border-transparent">Deny</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
