// Use environment variable for API URL, fallback to localhost for development
const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function getHeaders() {
    const token = localStorage.getItem("token");
    return {
        "Content-Type": "application/json",
        "Authorization": token ? `Bearer ${token}` : ""
    };
}

export async function getProjects() {
    const res = await fetch(`${BASE}/projects`, {
        headers: getHeaders()
    });
    return res.json();
}

export async function getRooms(projectId) {
    const res = await fetch(`${BASE}/rooms/${projectId}`, {
        headers: getHeaders()
    });
    return res.json();
}

export async function getMessages(roomId) {
    const res = await fetch(`${BASE}/messages/${roomId}`, {
        headers: getHeaders()
    });
    return res.json();
}


export async function clearRoomMessages(roomId) {
    const res = await fetch(`${BASE}/messages/room/${roomId}`, {
        method: "DELETE",
        headers: getHeaders()
    });
    return res.json();
}

export async function createProject(data) {
    const res = await fetch(`${BASE}/projects`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(data)
    });
    return res.json();
}

export async function createRoom(data) {
    const res = await fetch(`${BASE}/rooms`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(data)
    });
    return res.json();
}

export async function deleteProject(projectId) {
    const res = await fetch(`${BASE}/projects/${projectId}`, {
        method: "DELETE",
        headers: getHeaders()
    });
    return res.json();
}

export async function deleteRoom(roomId) {
    const res = await fetch(`${BASE}/rooms/${roomId}`, {
        method: "DELETE",
        headers: getHeaders()
    });
    return res.json();
}
