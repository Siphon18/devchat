import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
    const { login } = useAuth();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isRegistering, setIsRegistering] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        const apiBase = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

        try {
            let endpoint = isRegistering ? "/register" : "/token";
            let body;
            let headers = {};

            if (isRegistering) {
                body = JSON.stringify({ username, password });
                headers = { "Content-Type": "application/json" };
            } else {
                // OAuth2PasswordRequestForm expects form data
                body = new URLSearchParams();
                body.append("username", username);
                body.append("password", password);
                headers = { "Content-Type": "application/x-www-form-urlencoded" };
            }

            const res = await fetch(`${apiBase}${endpoint}`, {
                method: "POST",
                headers: headers,
                body: body
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.detail || "Authentication failed");
            }

            if (isRegistering) {
                // After register, automatically login
                setIsRegistering(false);
                alert("Account created! Please login.");
            } else {
                login(data.access_token);
            }

        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="flex h-screen w-screen items-center justify-center bg-discord-bg font-sans">
            <div className="bg-discord-sidebar p-8 rounded-lg shadow-2xl w-96 border border-discord-server-rail">
                <div className="flex justify-center mb-6">
                    <div className="w-40 h-16 rounded-[35px] bg-discord-blurple text-white flex items-center justify-center shadow-md">
                        <span className="font-bold text-2xl">Dev&lt;/&gt;Chat</span>
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-white text-center mb-2">
                    {isRegistering ? "Create an Account" : "Welcome Back!"}
                </h2>

                {error && <div className="bg-red-500/10 border border-red-500 text-red-500 p-2 rounded mb-4 text-sm text-center">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-discord-text-muted uppercase mb-2">Username</label>
                        <input
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-discord-server-rail text-discord-text-normal p-2.5 rounded focus:outline-none focus:ring-2 focus:ring-discord-blurple transition-all"
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-discord-text-muted uppercase mb-2">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-discord-server-rail text-discord-text-normal p-2.5 rounded focus:outline-none focus:ring-2 focus:ring-discord-blurple transition-all"
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-discord-blurple text-white font-medium py-2.5 rounded hover:bg-discord-blurple/80 transition-colors mb-4"
                    >
                        {isRegistering ? "Sign Up" : "Log In"}
                    </button>
                </form>

                <div className="text-center">
                    <button
                        onClick={() => setIsRegistering(!isRegistering)}
                        className="text-discord-blurple text-sm hover:underline"
                    >
                        {isRegistering ? "Already have an account? Log In" : "Need an account? Register"}
                    </button>
                </div>
            </div>
        </div>
    );
}
