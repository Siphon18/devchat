import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BrandMark, BrandWordmark } from "../components/BrandMark";

const FEATURES = [
    {
        icon: "💬",
        title: "Real-Time Chat",
        desc: "Instant messaging via WebSockets. Every keystroke delivered to your team in milliseconds.",
        accent: "#5865F2",
        glow: "rgba(88,101,242,0.3)",
    },
    {
        icon: "⚡",
        title: "Live Code Execution",
        desc: "Write and run Python code directly in the chat. Results broadcast to everyone in the room.",
        accent: "#10b981",
        glow: "rgba(16,185,129,0.3)",
    },
    {
        icon: "🔒",
        title: "Private Rooms",
        desc: "Invite-only channels for sensitive projects. Full access control with admin roles.",
        accent: "#f59e0b",
        glow: "rgba(245,158,11,0.3)",
    },
    {
        icon: "🚀",
        title: "Project Workspaces",
        desc: "Organise rooms under projects. Keep your team's conversations structured and searchable.",
        accent: "#06b6d4",
        glow: "rgba(6,182,212,0.3)",
    },
    {
        icon: "🎭",
        title: "Custom Avatars",
        desc: "Unique DiceBear avatars generated from your username and avatar style choice.",
        accent: "#a78bfa",
        glow: "rgba(167,139,250,0.3)",
    },
    {
        icon: "🐳",
        title: "Docker Ready",
        desc: "One command to spin up the full stack. Frontend, backend, database — all containerised.",
        accent: "#f43f5e",
        glow: "rgba(244,63,94,0.3)",
    },
];

const STEPS = [
    { num: "01", title: "Create an Account", desc: "Sign up in seconds with your username and choose your avatar style." },
    { num: "02", title: "Create a Project", desc: "Group related rooms under a project for your team or side project." },
    { num: "03", title: "Open a Channel", desc: "Create public or private channels inside each project." },
    { num: "04", title: "Chat & Code", desc: "Send messages, run Python snippets, and collaborate in real time." },
];

export default function LandingPage() {
    const navigate = useNavigate();
    const { token } = useAuth();
    const [scrolled, setScrolled] = useState(false);
    const [visible, setVisible] = useState({});

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    // Intersection observer for staggered section reveals
    useEffect(() => {
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) setVisible((v) => ({ ...v, [e.target.dataset.reveal]: true }));
                });
            },
            { threshold: 0.12 }
        );
        document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
        return () => io.disconnect();
    }, []);

    const reveal = (key) =>
        visible[key] ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8";

    return (
        <div className="min-h-screen bg-dc-bg text-text-primary overflow-x-hidden">

            {/* ── NAVBAR ── */}
            <nav
                className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "py-3 glass border-b border-white/[0.06]" : "py-5 bg-transparent"
                    }`}
            >
                <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                        <BrandWordmark markClassName="h-9 w-9" textClassName="text-lg" />
                    </div>

                    {/* Nav links */}
                    <div className="hidden md:flex items-center gap-8 text-sm text-text-secondary">
                        <a href="#features" className="hover:text-white transition-colors">Features</a>
                        <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
                    </div>

                    {/* CTA */}
                    <div className="flex items-center gap-3">
                        {token ? (
                            <button onClick={() => navigate("/app")} className="btn-primary text-sm px-5 py-2">
                                Open App →
                            </button>
                        ) : (
                            <>
                                <button onClick={() => navigate("/login")} className="btn-ghost text-sm px-5 py-2">
                                    Log In
                                </button>
                                <button onClick={() => navigate("/login?register=1")} className="btn-primary text-sm px-5 py-2">
                                    Get Started
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* ── HERO ── */}
            <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
                {/* Animated background orbs */}
                <div className="orb w-[600px] h-[600px] bg-[#5865F2] top-[-200px] left-[-200px]" />
                <div className="orb orb-reverse w-[500px] h-[500px] bg-[#7c3aed] bottom-[-150px] right-[-150px]" style={{ animationDelay: "2s" }} />
                <div className="orb w-[350px] h-[350px] bg-[#06b6d4] top-[30%] right-[10%]" style={{ animationDelay: "4s" }} />

                {/* Grid pattern overlay */}
                <div
                    className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{
                        backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
                        backgroundSize: "48px 48px",
                    }}
                />

                <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs text-text-secondary mb-8 animate-fade-in-up">
                        <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse-slow inline-block" />
                        Open Source · WebSocket Powered · Python Execution
                    </div>

                    {/* Headline */}
                    <h1
                        className="text-5xl md:text-7xl font-black tracking-tight leading-[1.08] mb-6 animate-fade-in-up"
                        style={{ animationDelay: "0.1s" }}
                    >
                        Chat. Code.
                        <br />
                        <span className="gradient-text">Collaborate.</span>
                    </h1>

                    {/* Subheadline */}
                    <p
                        className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up"
                        style={{ animationDelay: "0.2s" }}
                    >
                        DevChat is a developer-first chat platform where you can send messages,
                        run Python code, and collaborate in real-time — all in one place.
                    </p>

                    {/* CTA Buttons */}
                    <div
                        className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up"
                        style={{ animationDelay: "0.3s" }}
                    >
                        <button
                            onClick={() => navigate("/login?register=1")}
                            className="btn-primary text-base px-8 py-3.5 rounded-xl"
                        >
                            Start for Free →
                        </button>
                        <button
                            onClick={() => navigate("/login")}
                            className="btn-ghost text-base px-8 py-3.5 rounded-xl"
                        >
                            Sign In
                        </button>
                    </div>

                    {/* Hero mockup card */}
                    <div
                        className="mt-20 relative mx-auto max-w-3xl animate-fade-in-up"
                        style={{ animationDelay: "0.5s" }}
                    >
                        <div className="glass rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl">
                            {/* Window chrome */}
                            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                                <div className="w-3 h-3 rounded-full bg-rose-500/70" />
                                <div className="w-3 h-3 rounded-full bg-amber-500/70" />
                                <div className="w-3 h-3 rounded-full bg-green-500/70" />
                                <span className="ml-3 text-xs text-text-muted font-mono"># general-dev</span>
                            </div>
                            {/* Mock messages */}
                            <div className="p-5 space-y-4 text-left text-sm font-mono">
                                <MockMessage user="alex" color="#5865F2" msg="Hey team, check out this sorting algo 👇" delay="0s" />
                                <MockMessage user="alex" color="#5865F2" isCode delay="0.15s"
                                    msg={`def quicksort(arr):\n    if len(arr) <= 1: return arr\n    p = arr[len(arr)//2]\n    return quicksort([x for x in arr if x < p]) + \\\n           [x for x in arr if x == p] + \\\n           quicksort([x for x in arr if x > p])`}
                                />
                                <div className="bg-accent-green/10 border border-accent-green/20 rounded-lg px-3 py-2 text-accent-green text-xs" style={{ animationDelay: "0.3s" }}>
                                    ✓ Output: [1, 2, 3, 4, 9, 15]
                                </div>
                                <MockMessage user="priya" color="#10b981" msg="Sick! Can you make it handle duplicates?" delay="0.45s" />
                            </div>
                        </div>
                        {/* Glow below card */}
                        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-accent-purple/20 blur-3xl rounded-full" />
                    </div>
                </div>
            </section>

            {/* ── FEATURES ── */}
            <section id="features" className="py-32 px-6">
                <div className="max-w-6xl mx-auto">
                    <div
                        data-reveal="features-header"
                        className={`text-center mb-16 transition-all duration-700 ${reveal("features-header")}`}
                    >
                        <span className="text-accent-purple text-sm font-semibold tracking-widest uppercase">Features</span>
                        <h2 className="text-4xl md:text-5xl font-black mt-3 mb-4">
                            Everything developers <span className="gradient-text">need</span>
                        </h2>
                        <p className="text-text-secondary max-w-xl mx-auto">
                            Built specifically for developer teams who want to move fast and stay in flow.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {FEATURES.map((f, i) => (
                            <div
                                key={f.title}
                                data-reveal={`feat-${i}`}
                                className={`glass rounded-2xl p-6 group cursor-default transition-all duration-700 hover:-translate-y-1 ${reveal(`feat-${i}`)}`}
                                style={{ transitionDelay: `${i * 80}ms` }}
                            >
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-5 transition-transform duration-300 group-hover:scale-110"
                                    style={{ background: `${f.accent}22`, boxShadow: `0 0 20px ${f.glow}` }}
                                >
                                    {f.icon}
                                </div>
                                <h3 className="font-bold text-lg text-white mb-2">{f.title}</h3>
                                <p className="text-text-secondary text-sm leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── HOW IT WORKS ── */}
            <section id="how-it-works" className="py-32 px-6 relative">
                <div
                    className="absolute inset-0 opacity-[0.015] pointer-events-none"
                    style={{
                        backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                        backgroundSize: "32px 32px",
                    }}
                />
                <div className="max-w-5xl mx-auto relative z-10">
                    <div
                        data-reveal="steps-header"
                        className={`text-center mb-16 transition-all duration-700 ${reveal("steps-header")}`}
                    >
                        <span className="text-accent-cyan text-sm font-semibold tracking-widest uppercase">How It Works</span>
                        <h2 className="text-4xl md:text-5xl font-black mt-3">
                            Up and running in <span className="gradient-text">minutes</span>
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {STEPS.map((s, i) => (
                            <div
                                key={s.num}
                                data-reveal={`step-${i}`}
                                className={`relative flex gap-5 items-start glass rounded-2xl p-6 transition-all duration-700 ${reveal(`step-${i}`)}`}
                                style={{ transitionDelay: `${i * 100}ms` }}
                            >
                                <div className="flex-shrink-0 w-12 h-12 rounded-xl gradient-animated flex items-center justify-center font-black text-white text-sm shadow-lg">
                                    {s.num}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-lg mb-1">{s.title}</h3>
                                    <p className="text-text-secondary text-sm leading-relaxed">{s.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA BANNER ── */}
            <section className="py-24 px-6">
                <div
                    data-reveal="cta"
                    className={`max-w-3xl mx-auto text-center transition-all duration-700 ${reveal("cta")}`}
                >
                    <div className="glass rounded-3xl p-12 relative overflow-hidden">
                        <div className="orb w-72 h-72 bg-[#5865F2] top-[-60px] left-[-60px]" style={{ opacity: 0.15 }} />
                        <div className="orb w-72 h-72 bg-[#06b6d4] bottom-[-60px] right-[-60px]" style={{ opacity: 0.1 }} />
                        <div className="relative z-10">
                            <h2 className="text-4xl font-black mb-4">Start building together</h2>
                            <p className="text-text-secondary mb-8 max-w-md mx-auto">
                                Free, open source, and self-hostable. Your data stays yours.
                            </p>
                            <button
                                onClick={() => navigate("/login?register=1")}
                                className="btn-primary text-base px-10 py-4 rounded-xl"
                            >
                                Create Free Account
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer className="border-t border-white/[0.05] py-10 px-6">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-text-muted text-sm">
                    <div className="flex items-center gap-2">
                        <BrandMark className="h-7 w-7 rounded-lg" />
                        <span>DevChat — built for developers</span>
                    </div>
                    <div className="flex gap-6">
                        <a href="#features" className="hover:text-white transition-colors">Features</a>
                        <a href="#how-it-works" className="hover:text-white transition-colors">Docs</a>
                        <span>MIT License</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function MockMessage({ user, color, msg, isCode, delay }) {
    return (
        <div className="flex gap-3 items-start animate-fade-in-up" style={{ animationDelay: delay }}>
            <div
                className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mt-0.5"
                style={{ background: color }}
            >
                {user[0].toUpperCase()}
            </div>
            <div>
                <span className="text-xs font-semibold mr-2" style={{ color }}>{user}</span>
                {isCode ? (
                    <pre className="mt-1 bg-dc-rail rounded-lg p-3 text-accent-green text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap">{msg}</pre>
                ) : (
                    <span className="text-text-secondary">{msg}</span>
                )}
            </div>
        </div>
    );
}
