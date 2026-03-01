from fastapi import WebSocket
from typing import Dict, List, Set


class ConnectionManager:
    def __init__(self):
        # room_id -> connection -> username
        self.active_connections: Dict[int, Dict[WebSocket, str]] = {}
        # room_id -> set of online usernames
        self.online_users: Dict[int, Set[str]] = {}

    async def connect(self, room_id: int, websocket: WebSocket, username: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = {}
            self.online_users[room_id] = set()
        self.active_connections[room_id][websocket] = username
        self.online_users[room_id].add(username)

    def disconnect(self, room_id: int, websocket: WebSocket, username: str):
        if room_id not in self.active_connections:
            return

        self.active_connections[room_id].pop(websocket, None)

        if room_id in self.online_users:
            # Keep user marked online if they still have another open socket in this room.
            has_other_connections = any(
                u == username for u in self.active_connections[room_id].values()
            )
            if not has_other_connections:
                self.online_users[room_id].discard(username)

        if not self.active_connections[room_id]:
            del self.active_connections[room_id]
        if room_id in self.online_users and not self.online_users[room_id]:
            del self.online_users[room_id]

    def get_online_users(self, room_id: int) -> List[str]:
        return list(self.online_users.get(room_id, set()))

    async def broadcast(self, room_id: int, message: dict):
        if room_id not in self.active_connections:
            return

        dead = []
        for connection in list(self.active_connections[room_id].keys()):
            try:
                await connection.send_json(message)
            except Exception:
                dead.append(connection)

        for connection in dead:
            username = self.active_connections[room_id].get(connection)
            self.active_connections[room_id].pop(connection, None)
            if username and room_id in self.online_users:
                has_other_connections = any(
                    u == username for u in self.active_connections[room_id].values()
                )
                if not has_other_connections:
                    self.online_users[room_id].discard(username)

        if room_id in self.active_connections and not self.active_connections[room_id]:
            del self.active_connections[room_id]
        if room_id in self.online_users and not self.online_users[room_id]:
            del self.online_users[room_id]


manager = ConnectionManager()
