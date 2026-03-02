import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const apiBase = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function OAuthCallback() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [error, setError] = useState("");

    useEffect(() => {
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const provider = localStorage.getItem("oauth_provider");

        if (!code || !provider) {
            setError("Missing authorization code or provider info.");
            return;
        }

        (async () => {
            try {
                const res = await fetch(`${apiBase}/oauth/${provider}/callback`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code, state }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || "OAuth login failed");

                localStorage.removeItem("oauth_provider");
                login(data.access_token);
                navigate("/app");
            } catch (err) {
                setError(err.message);
            }
        })();
    }, [searchParams, login, navigate]);

    return (
        <div className="flex h-screen w-screen items-center justify-center bg-dc-bg">
            <div className="flex flex-col items-center gap-4">
                {error ? (
                    <div className="text-center">
                        <div className="text-rose-400 text-lg font-semibold mb-2">Authentication Failed</div>
                        <p className="text-text-secondary text-sm max-w-xs">{error}</p>
                        <button
                            onClick={() => navigate("/login")}
                            className="mt-4 text-accent-purple hover:text-text-accent text-sm font-semibold transition-colors"
                        >
                            ← Back to Login
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="w-12 h-12 rounded-xl gradient-animated flex items-center justify-center text-white font-black text-lg animate-pulse-slow">DC</div>
                        <div className="text-text-muted text-sm">Signing you in...</div>
                    </>
                )}
            </div>
        </div>
    );
}
