'use client';

import { io, type Socket } from 'socket.io-client';

// ─────────────────────────────────────────────────────────────────────
// Presence only: how many observers are currently watching a town.
// Degrades silently when the realtime server isn't running.
// ─────────────────────────────────────────────────────────────────────

export interface ObserveHandle {
  socket: Socket | null;
  dispose: () => void;
}

export function observeTown(slug: string, onCount: (others: number) => void): ObserveHandle {
  // Only connect when a realtime server is configured. In dev we default to
  // the local one; in production we stay quiet unless a URL is set, so
  // deployed visitors never hammer localhost.
  const url =
    process.env.NEXT_PUBLIC_REALTIME_URL ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '');
  if (!url) return { socket: null, dispose() {} };
  let socket: Socket | null = null;
  let others = 0;

  try {
    socket = io(url, {
      transports: ['websocket'],
      reconnectionAttempts: 3,
      reconnectionDelay: 3000,
      timeout: 4000,
    });
  } catch {
    /* observer count simply stays hidden */
  }

  if (socket) {
    socket.on('connect', () => socket!.emit('join', { room: `town:${slug}` }));
    socket.on('roster', ({ count }: { count: number }) => {
      others = count;
      onCount(others);
    });
    socket.on('presence', ({ count }: { count: number }) => {
      others = count;
      onCount(others);
    });
  }

  return {
    socket,
    dispose() {
      socket?.removeAllListeners();
      socket?.disconnect();
    },
  };
}
