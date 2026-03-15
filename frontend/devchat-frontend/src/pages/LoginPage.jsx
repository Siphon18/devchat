import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BrandMark, BrandWordmark } from "../components/BrandMark";

const apiBase = () => import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function GitHubIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
        </svg>
    );
}

function GoogleIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
    );
}

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [isRegistering, setIsRegistering] = useState(searchParams.get("register") === "1");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
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
        if (isRegistering && !email.trim()) errs.email = "Email is required";
        if (isRegistering && email.trim() && (!email.includes("@") || !email.split("@")[1]?.includes("."))) {
            errs.email = "Enter a valid email address";
        }
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
                    body: JSON.stringify({ username: username.trim(), email: email.trim(), password, gender }),
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

    const startOAuth = (provider) => {
        localStorage.setItem("oauth_provider", provider);
        window.location.href = `${apiBase()}/oauth/${provider}`;
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
                    <div className="mx-auto mb-8 flex justify-center animate-float">
                        <BrandMark className="h-20 w-20 rounded-2xl" />
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
                            <div className="lg:hidden">
                                <BrandWordmark markClassName="h-9 w-9" textClassName="text-lg" />
                            </div>
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
                            <label htmlFor="username" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                                Username
                            </label>
                            <input
                                id="username"
                                name="username"
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

                        {isRegistering && (
                            <div className="animate-fade-in-up">
                                <label htmlFor="email" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                                    Email
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => { setEmail(e.target.value); setFieldErrors(fe => ({ ...fe, email: "" })); }}
                                    placeholder="you@company.com"
                                    autoComplete="email"
                                    className={`input-field ${fieldErrors.email ? "error" : ""}`}
                                />
                                {fieldErrors.email && (
                                    <p className="text-rose-400 text-xs mt-1.5">{fieldErrors.email}</p>
                                )}
                                <p className="text-text-muted text-xs mt-1.5">
                                    We&apos;ll use this to send your welcome email.
                                </p>
                            </div>
                        )}

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    name="password"
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

                    {/* OAuth divider */}
                    <div className="flex items-center gap-3 my-6">
                        <div className="flex-1 h-px bg-white/[0.08]" />
                        <span className="text-text-muted text-xs uppercase tracking-wider">or continue with</span>
                        <div className="flex-1 h-px bg-white/[0.08]" />
                    </div>

                    {/* OAuth buttons */}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => startOAuth("github")}
                            className="flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] text-white hover:bg-white/[0.08] transition-all duration-200 text-sm font-medium"
                        >
                            <GitHubIcon />
                            GitHub
                        </button>
                        <button
                            type="button"
                            onClick={() => startOAuth("google")}
                            className="flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] text-white hover:bg-white/[0.08] transition-all duration-200 text-sm font-medium"
                        >
                            <GoogleIcon />
                            Google
                        </button>
                    </div>

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
