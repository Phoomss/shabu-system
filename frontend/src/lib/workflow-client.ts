import type { Socket } from "socket.io-client";
import api from "./api";
import type { KitchenSection } from "@/types";

export const MAX_ITEM_QUANTITY = 99;
export const MAX_ORDER_ITEMS = 100;

export function latestRequest() {
  let version = 0;
  return {
    begin: () => ++version,
    isCurrent: (request: number) => request === version,
    invalidate: () => {
      version++;
    },
  };
}

export async function listKitchens(): Promise<KitchenSection[]> {
  return (await api.get("/kitchens")).data.data;
}

/** Rejoin on every connection and sync only after server authorizes a room. */
export function bindRoomSync(
  socket: Socket,
  join: () => void,
  joinedEvent: "session:joined" | "kitchen:joined",
  sync: () => void,
  events: string[],
) {
  const onConnect = () => join();
  const onSync = () => sync();
  socket.on("connect", onConnect);
  socket.on(joinedEvent, onSync);
  for (const event of events) socket.on(event, onSync);
  if (socket.connected) onConnect();
  return () => {
    socket.off("connect", onConnect);
    socket.off(joinedEvent, onSync);
    for (const event of events) socket.off(event, onSync);
  };
}
