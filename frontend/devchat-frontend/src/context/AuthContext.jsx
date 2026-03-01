import { createContext, useState, useContext, useEffect } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem("token"));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            // Decode token or fetch user profile
            // For now, just trust the token exists and we decode the username if possible
            // In a real app, you'd call /users/me here
            const fetchUser = async () => {
                try {
                    const apiBase = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
                    const res = await fetch(`${apiBase}/users/me`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const userData = await res.json();
                        setUser(userData);
                    } else {
                        logout();
                    }
                } catch {
                    logout();
                } finally {
                    setLoading(false);
                }
            };
            fetchUser();
        } else {
            setLoading(false);
        }
    }, [token]);

    const login = (token) => {
        localStorage.setItem("token", token);
        setToken(token);
    };

    const logout = () => {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, setUser, token, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
