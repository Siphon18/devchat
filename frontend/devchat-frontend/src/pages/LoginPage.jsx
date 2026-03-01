import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";

const apiBase = () => import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [isRegistering, setIsRegistering] = useState(searchParams.get("register") === "1");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [gender, setGender] = useState("neutral");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});

    // Sync ?register= param
    useEffect(() => {
        setIsRegistering(searchParams.get("register") === "1");
        setError("");
        setFieldErrors({});
    }, [searchParams]);

    const validate = () => {
        const errs = {};
        if (!username.trim()) errs.username = "Username is required";
        if (username.length > 50) errs.username = "Max 50 characters";
        if (!password) errs.password = "Password is required";
        if (isRegistering && password.length < 6) errs.password = "Min 6 characters";
        setFieldErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const doLogin = async (u, p) => {
        const body = new URLSearchParams();
        body.append("username", u);
        body.append("password", p);
        const res = await fetch(`${apiBase()}/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Login failed");
        return data.access_token;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        setError("");
        setLoading(true);

        try {
            if (isRegistering) {
                const res = await fetch(`${apiBase()}/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username: username.trim(), password, gender }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || "Registration failed");

                // Auto-login after registration
                const token = await doLogin(username.trim(), password);
                login(token);
                navigate("/app");
            } else {
                const token = await doLogin(username.trim(), password);
                login(token);
                navigate("/app");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const switchMode = () => {
        setIsRegistering(!isRegistering);
        setError("");
        setFieldErrors({});
        navigate(isRegistering ? "/login" : "/login?register=1", { replace: true });
    };

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-dc-bg">

            {/* ── LEFT PANEL (brand + visuals) ── */}
            <div className="hidden lg:flex flex-col flex-1 relative overflow-hidden items-center justify-center p-12">
                {/* Background orbs */}
                <div className="orb w-[500px] h-[500px] bg-[#5865F2] top-[-200px] left-[-200px]" />
                <div className="orb orb-reverse w-[400px] h-[400px] bg-[#7c3aed] bottom-[-150px] right-[-100px]" />
                <div className="orb w-[250px] h-[250px] bg-[#06b6d4] top-[40%] right-[5%]" style={{ animationDelay: "3s" }} />

                {/* Grid */}
                <div
                    className="absolute inset-0 opacity-[0.04] pointer-events-none"
                    style={{
                        backgroundImage: "linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)",
                        backgroundSize: "40px 40px",
                    }}
                />

                <div className="relative z-10 text-center max-w-sm">
                    {/* Logo mark */}
                    <div className="w-20 h-20 rounded-2xl gradient-animated flex items-center justify-center text-white font-black text-3xl shadow-2xl mx-auto mb-8 animate-float">
                        DC
                    </div>

                    <h2 className="text-4xl font-black mb-4 leading-tight">
                        Code together,<br /><span className="gradient-text">ship faster.</span>
                    </h2>
                    <p className="text-text-secondary leading-relaxed mb-10">
                        Real-time chat with built-in Python execution. The dev collaboration tool you actually want.
                    </p>

                    {/* Feature pills */}
                    <div className="flex flex-col gap-3 text-left">
                        {[
                            { icon: "⚡", text: "Instant WebSocket messaging" },
                            { icon: "🐍", text: "Run Python in the chat" },
                            { icon: "🔒", text: "Private invite-only rooms" },
                        ].map((f) => (
                            <div key={f.text} className="flex items-center gap-3 glass rounded-xl px-4 py-3">
                                <span className="text-xl">{f.icon}</span>
                                <span className="text-sm text-text-secondary">{f.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── RIGHT PANEL (form) ── */}
            <div className="flex flex-col items-center justify-center w-full lg:w-[460px] flex-shrink-0 px-8 py-12 relative bg-dc-surface border-l border-white/[0.05]">

                {/* Back to landing */}
                <button
                    onClick={() => navigate("/")}
                    className="absolute top-6 left-6 text-text-muted hover:text-white text-sm flex items-center gap-1.5 transition-colors"
                >
                    ← Back
                </button>

                <div className="w-full max-w-sm">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-2.5 mb-6">
                            <div className="w-9 h-9 rounded-xl gradient-animated flex items-center justify-center text-white font-black text-sm lg:hidden">DC</div>
                            <span className="font-bold text-lg text-white lg:hidden">DevChat</span>
                        </div>
                        <h1 className="text-3xl font-black text-white mb-2">
                            {isRegistering ? "Create account" : "Welcome back"}
                        </h1>
                        <p className="text-text-secondary text-sm">
                            {isRegistering ? "Join the DevChat community." : "Sign in to your workspace."}
                        </p>
                    </div>

                    {/* Error banner */}
                    {error && (
                        <div className="mb-5 flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/25 rounded-xl px-4 py-3 animate-fade-in">
                            <span className="text-rose-400 mt-0.5">⚠</span>
                            <span className="text-rose-400 text-sm">{error}</span>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Username */}
                        <div>
                            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                                Username
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => { setUsername(e.target.value); setFieldErrors(fe => ({ ...fe, username: "" })); }}
                                placeholder="your_username"
                                autoComplete="username"
                                className={`input-field ${fieldErrors.username ? "error" : ""}`}
                            />
                            {fieldErrors.username && (
                                <p className="text-rose-400 text-xs mt-1.5">{fieldErrors.username}</p>
                            )}
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value); setFieldErrors(fe => ({ ...fe, password: "" })); }}
                                    placeholder={isRegistering ? "Min 6 characters" : "Your password"}
                                    autoComplete={isRegistering ? "new-password" : "current-password"}
                                    className={`input-field pr-12 ${fieldErrors.password ? "error" : ""}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors text-sm"
                                    tabIndex={-1}
                                >
                                    {showPassword ? "🙈" : "👁"}
                                </button>
                            </div>
                            {fieldErrors.password && (
                                <p className="text-rose-400 text-xs mt-1.5">{fieldErrors.password}</p>
                            )}
                        </div>

                        {/* Avatar style (register only) */}
                        {isRegistering && (
                            <div className="animate-fade-in-up">
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                                    Avatar Style
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { val: "neutral", label: "Neutral", emoji: "🌟" },
                                        { val: "male", label: "Masc", emoji: "🧑‍💻" },
                                        { val: "female", label: "Femme", emoji: "👩‍💻" },
                                    ].map((g) => (
                                        <button
                                            key={g.val}
                                            type="button"
                                            onClick={() => setGender(g.val)}
                                            className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm font-medium transition-all duration-200 ${gender === g.val
                                                    ? "border-accent-purple/60 bg-accent-purple/10 text-white"
                                                    : "border-white/[0.08] bg-white/[0.03] text-text-secondary hover:bg-white/[0.06]"
                                                }`}
                                        >
                                            <span className="text-xl">{g.emoji}</span>
                                            <span className="text-xs">{g.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full py-3.5 rounded-xl mt-2 relative overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <LoadingSpinner />
                                    {isRegistering ? "Creating account..." : "Signing in..."}
                                </span>
                            ) : (
                                isRegistering ? "Create Account" : "Sign In"
                            )}
                        </button>
                    </form>

                    {/* Toggle */}
                    <div className="mt-6 text-center">
                        <span className="text-text-muted text-sm">
                            {isRegistering ? "Already have an account?" : "Don't have an account?"}{" "}
                        </span>
                        <button
                            onClick={switchMode}
                            className="text-sm font-semibold text-accent-purple hover:text-text-accent transition-colors"
                        >
                            {isRegistering ? "Sign In" : "Sign Up"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function LoadingSpinner() {
    return (
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    );
}
