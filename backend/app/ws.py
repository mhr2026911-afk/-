"""WebSocket hub: presence plus realtime message and call signalling."""

from __future__ import annotations

import asyncio
from collections import defaultdict


class Hub:
    def __init__(self) -> None:
        self._conns: dict[str, set] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, ws) -> None:
        async with self._lock:
            self._conns[user_id].add(ws)

    async def disconnect(self, user_id: str, ws) -> None:
        async with self._lock:
            self._conns[user_id].discard(ws)
            empty = not self._conns[user_id]
            if empty:
                self._conns.pop(user_id, None)

    def is_online(self, user_id: str) -> bool:
        return bool(self._conns.get(user_id))

    def online_ids(self) -> set[str]:
        return {uid for uid, conns in self._conns.items() if conns}

    async def send(self, user_id: str, payload: dict) -> None:
        for ws in list(self._conns.get(user_id, ())):
            try:
                await ws.send_json(payload)
            except Exception:  # pragma: no cover - client went away
                await self.disconnect(user_id, ws)

    async def broadcast(self, user_ids, payload: dict) -> None:
        for uid in set(user_ids):
            await self.send(uid, payload)

    async def broadcast_all(self, payload: dict) -> None:
        await self.broadcast(self.online_ids(), payload)


HUB = Hub()
