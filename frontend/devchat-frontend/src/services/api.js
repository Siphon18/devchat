// Use environment variable for API URL, fallback to localhost for development
const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export async function getProjects() {
    const res = await fetch(`${BASE}/projects`);
    return res.json();
}

export async function getRooms(projectId) {
    const res = await fetch(`${BASE}/rooms/${projectId}`);
    return res.json();
}

export async function getMessages(roomId) {
    const res = await fetch(`${BASE}/messages/${roomId}`);
    return res.json();
}


export async function clearRoomMessages(roomId) {
    const res = await fetch(`${BASE}/messages/room/${roomId}`, {
        method: "DELETE"
    });
    return res.json();
}

export async function createProject(data) {
    const res = await fetch(`${BASE}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
    return res.json();
}

export async function createRoom(data) {
    const res = await fetch(`${BASE}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
    return res.json();
}

export async function deleteProject(projectId) {
    const res = await fetch(`${BASE}/projects/${projectId}`, {
        method: "DELETE"
    });
    return res.json();
}

export async function deleteRoom(roomId) {
    const res = await fetch(`${BASE}/rooms/${roomId}`, {
        method: "DELETE"
    });
    return res.json();
}
