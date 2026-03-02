import { useEffect, useState } from "react";
import { getInvites, respondToInvite } from "../services/api";

export default function InboxModal({ onClose, onChange }) {
    const [invites, setInvites] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadInvites();
    }, []);

    async function loadInvites() {
        try {
            const data = await getInvites();
            setInvites(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    const handleAction = async (id, action) => {
        try {
            await respondToInvite(id, action);
            await loadInvites();
            if (onChange) onChange(); // refresh projects/rooms
        } catch (e) {
            alert(e.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] animate-fade-in" onClick={onClose}>
            <div className="glass-strong rounded-2xl p-6 w-[calc(100vw-2rem)] max-w-[400px] animate-scale-in border border-white/[0.08]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">Inbox</h3>
                    <button onClick={onClose} className="text-text-muted hover:text-white p-1 rounded-lg hover:bg-dc-hover">✕</button>
                </div>

                {loading ? (
                    <div className="text-center text-text-muted py-6">Loading...</div>
                ) : invites.length === 0 ? (
                    <div className="text-center text-text-muted py-8 italic">No pending invites.</div>
                ) : (
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                        {invites.map(inv => (
                            <div key={inv.id} className="p-3 bg-black/20 rounded-lg border border-white/[0.05]">
                                <p className="text-sm text-text-secondary mb-2">
                                    <span className="font-semibold text-white">{inv.inviter_name}</span> invited you to join the {inv.target_type} <span className="font-semibold text-white">{inv.target_name}</span>
                                </p>
                                <div className="flex gap-2">
                                    <button onClick={() => handleAction(inv.id, "accept")} className="flex-1 btn-primary py-1.5 text-xs">Accept</button>
                                    <button onClick={() => handleAction(inv.id, "decline")} className="flex-1 btn-ghost py-1.5 text-xs text-discord-red ring-discord-red/30 hover:bg-discord-red/10">Decline</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
