import { useEffect, useState } from "react";
import { getInvites, respondToInvite, getIncomingRequests, respondToRequest } from "../services/api";
import { useToast } from "./Toast";

export default function InboxModal({ onClose, onChange }) {
    const [invites, setInvites] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("invites");
    const toast = useToast();

    useEffect(() => {
        loadAll();
    }, []);

    async function loadAll() {
        try {
            const [inv, req] = await Promise.all([getInvites(), getIncomingRequests()]);
            setInvites(Array.isArray(inv) ? inv : []);
            setRequests(Array.isArray(req) ? req : []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    const handleInviteAction = async (id, action) => {
        try {
            await respondToInvite(id, action);
            await loadAll();
            if (onChange) onChange();
            toast.success(action === "accept" ? "Invite accepted!" : "Invite declined");
        } catch (e) {
            toast.error(e.message);
        }
    };

    const handleRequestAction = async (id, action) => {
        try {
            await respondToRequest(id, action);
            await loadAll();
            if (onChange) onChange();
            toast.success(action === "approve" ? "Request approved!" : "Request denied");
        } catch (e) {
            toast.error(e.message);
        }
    };

    const inviteCount = invites.length;
    const requestCount = requests.length;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] animate-fade-in" onClick={onClose}>
            <div className="glass-panel rounded-2xl p-6 w-[calc(100vw-2rem)] max-w-[440px] animate-scale-in" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Inbox</h3>
                    <button onClick={onClose} className="btn-icon">✕</button>
                </div>

                {/* Tabs */}
                <div className="glass-tabs flex gap-1 mb-4">
                    <button
                        onClick={() => setTab("invites")}
                        className={`flex-1 px-3 py-1.5 text-xs font-semibold transition-all ${tab === "invites" ? "active text-accent-purple" : "text-text-muted hover:text-white"}`}
                    >
                        Invites {inviteCount > 0 && <span className="ml-1 glass-badge bg-accent-purple/20 text-accent-purple">{inviteCount}</span>}
                    </button>
                    <button
                        onClick={() => setTab("requests")}
                        className={`flex-1 px-3 py-1.5 text-xs font-semibold transition-all ${tab === "requests" ? "active text-accent-purple" : "text-text-muted hover:text-white"}`}
                    >
                        Requests {requestCount > 0 && <span className="ml-1 glass-badge bg-orange-500/20 text-orange-400">{requestCount}</span>}
                    </button>
                </div>

                {loading ? (
                    <div className="space-y-3 py-4">
                        <div className="skeleton skeleton-block"></div>
                        <div className="skeleton skeleton-block"></div>
                    </div>
                ) : tab === "invites" ? (
                    invites.length === 0 ? (
                        <div className="empty-state py-8">
                            <div className="empty-state-icon">📬</div>
                            <div className="empty-state-title">No pending invites</div>
                            <div className="empty-state-desc">When someone invites you to a project or room, it will appear here.</div>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                            {invites.map(inv => (
                                <div key={inv.id} className="p-3 glass-message rounded-xl animate-fade-in-up">
                                    <p className="text-sm text-text-secondary mb-2">
                                        <span className="font-semibold text-white">{inv.inviter_name}</span> invited you to join the {inv.target_type} <span className="font-semibold text-white">{inv.target_name}</span>
                                    </p>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleInviteAction(inv.id, "accept")} className="flex-1 btn-primary py-1.5 text-xs">Accept</button>
                                        <button onClick={() => handleInviteAction(inv.id, "decline")} className="flex-1 btn-ghost py-1.5 text-xs text-discord-red hover:bg-discord-red/10">Decline</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    requests.length === 0 ? (
                        <div className="empty-state py-8">
                            <div className="empty-state-icon">📋</div>
                            <div className="empty-state-title">No pending requests</div>
                            <div className="empty-state-desc">Join requests from users will appear here for your review.</div>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                            {requests.map(req => (
                                <div key={req.id} className="p-3 glass-message rounded-xl animate-fade-in-up">
                                    <p className="text-sm text-text-secondary mb-2">
                                        <span className="font-semibold text-white">{req.username}</span> wants to join {req.target_type} <span className="font-semibold text-white">{req.target_name}</span>
                                    </p>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleRequestAction(req.id, "approve")} className="flex-1 btn-primary py-1.5 text-xs">Approve</button>
                                        <button onClick={() => handleRequestAction(req.id, "deny")} className="flex-1 btn-ghost py-1.5 text-xs text-discord-red hover:bg-discord-red/10">Deny</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
