"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useApp } from "@/lib/app-context";

let socket: Socket | null = null;

export function useSocket() {
  const { user } = useApp();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      console.log('[useSocket] No user, skipping connection');
      return;
    }

    if (!socket) {
      const wsUrl = `${window.location.protocol}//${window.location.hostname}:4000/ws`;
      console.log('[useSocket] Connecting to:', wsUrl);
      socket = io(wsUrl, { auth: { userId: user.id }, transports: ["websocket", "polling"] });

      socket.on("connect", () => {
        console.log('[useSocket] Connected:', socket?.id);
        setConnected(true);
      });
      socket.on("disconnect", (reason) => {
        console.log('[useSocket] Disconnected:', reason);
        setConnected(false);
      });
      socket.on("connect_error", (err) => {
        console.error('[useSocket] Connection error:', err);
      });
      socket.on("pong", () => {});
    }

    if (socket.connected) setConnected(true);

    return () => {};
  }, [user?.id]);

  const emit = useCallback((event: string, data?: any) => {
    socket?.emit(event, data);
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socket?.on(event, handler);
    return () => { socket?.off(event, handler); };
  }, []);

  return { socket, connected, emit, on };
}
