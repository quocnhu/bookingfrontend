"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useApp } from "@/lib/app-context";

let socket: Socket | null = null;

export function useSocket() {
  const { user } = useApp();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    if (!socket) {
      socket = io(
        typeof window !== "undefined"
          ? `${window.location.protocol}//${window.location.hostname}:4000/ws`
          : "http://localhost:4000/ws",
        { auth: { userId: user.id }, transports: ["websocket", "polling"] },
      );

      socket.on("connect", () => setConnected(true));
      socket.on("disconnect", () => setConnected(false));
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
