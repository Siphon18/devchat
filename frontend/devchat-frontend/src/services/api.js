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
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to clear messages");
    }
    return res.json();
}

export async function createProject(name, isPublic = false) {
    const res = await fetch(`${BASE}/projects`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ name, is_public: isPublic })
    });
    return res.json();
}

export async function getPublicProjects() {
    const res = await fetch(`${BASE}/projects/public`, {
        headers: getHeaders()
    });
    return res.json();
}

export async function joinPublicProject(projectId) {
    const res = await fetch(`${BASE}/projects/${projectId}/join`, {
        method: "POST",
        headers: getHeaders()
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to join project");
    }
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

export async function editMessage(messageId, content) {
    const res = await fetch(`${BASE}/messages/${messageId}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({ content })
    });
    if (!res.ok) throw new Error("Failed to edit message");
    return res.json();
}

export async function deleteMessage(messageId) {
    const res = await fetch(`${BASE}/messages/${messageId}`, {
        method: "DELETE",
        headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to delete message");
    return res.json();
}

// --- Users & Access Control ---

export async function searchUsers(query) {
    const res = await fetch(`${BASE}/users/search?q=${encodeURIComponent(query)}`, {
        headers: getHeaders()
    });
    return res.json();
}

export async function sendInvite(targetType, targetId, username) {
    const res = await fetch(`${BASE}/invites/${targetType}/${targetId}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ username })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Invite failed");
    }
    return res.json();
}

export async function getInvites() {
    const res = await fetch(`${BASE}/invites/me`, {
        headers: getHeaders()
    });
    return res.json();
}

export async function respondToInvite(inviteId, action) {
    const res = await fetch(`${BASE}/invites/${inviteId}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ action })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Action failed");
    }
    return res.json();
}

export async function sendJoinRequest(targetType, targetId) {
    const res = await fetch(`${BASE}/requests/${targetType}/${targetId}`, {
        method: "POST",
        headers: getHeaders()
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Request failed");
    }
    return res.json();
}

export async function getRequests(targetType, targetId) {
    const res = await fetch(`${BASE}/requests/${targetType}/${targetId}`, {
        headers: getHeaders()
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to fetch requests");
    }
    return res.json();
}

export async function respondToRequest(requestId, action) {
    const res = await fetch(`${BASE}/requests/${requestId}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({ action })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Action failed");
    }
    return res.json();
}

export async function getRoomMembers(roomId) {
    const res = await fetch(`${BASE}/rooms/${roomId}/members`, {
        headers: getHeaders()
    });
    return res.json();
}

export async function getProjectMembers(projectId) {
    const res = await fetch(`${BASE}/projects/${projectId}/members`, {
        headers: getHeaders()
    });
    return res.json();
}

export async function getRoomOnline(roomId) {
    const res = await fetch(`${BASE}/rooms/${roomId}/online`, {
        headers: getHeaders()
    });
    return res.json();
}

export async function getInviteCount() {
    const res = await fetch(`${BASE}/invites/me/count`, {
        headers: getHeaders()
    });
    return res.json();
}

export async function getUnreadCounts(projectId) {
    const res = await fetch(`${BASE}/rooms/${projectId}/unread`, {
        headers: getHeaders()
    });
    return res.json();
}

export async function getAllUnreadCounts() {
    const res = await fetch(`${BASE}/users/me/unread`, {
        headers: getHeaders()
    });
    return res.json();
}

export async function markRoomRead(roomId) {
    const res = await fetch(`${BASE}/rooms/${roomId}/read`, {
        method: "POST",
        headers: getHeaders()
    });
    return res.json();
}

export async function uploadAttachment(file) {
    const token = localStorage.getItem("token");
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${BASE}/uploads`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to upload file");
    }
    return res.json();
}
