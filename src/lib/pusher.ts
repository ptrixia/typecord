import PusherServer from "pusher";
import PusherClient from "pusher-js";

export const pusherServer = new PusherServer({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: "sa1",
  useTLS: true,
});

declare global {
  interface Window {
    __typecordPusherClient?: PusherClient;
  }
}

export function getPusherClient(): PusherClient | null {
  if (typeof window === "undefined") {
    return null;
  }

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;

  if (!key) {
    console.error(
      "[PUSHER] NEXT_PUBLIC_PUSHER_KEY não está configurada.",
    );

    return null;
  }

  if (!window.__typecordPusherClient) {
    window.__typecordPusherClient = new PusherClient(key, {
      cluster: "sa1",
    });
  }

  return window.__typecordPusherClient;
}

export const pusherClient = new Proxy({} as PusherClient, {
  get(_target, property) {
    const client = getPusherClient();

    if (!client) {
      if (typeof window === "undefined") {
        return undefined;
      }

      throw new Error(
        "[PUSHER] Cliente Pusher não está disponível.",
      );
    }

    const value = Reflect.get(client, property, client);

    if (typeof value === "function") {
      return value.bind(client);
    }

    return value;
  },

  set(_target, property, value) {
    const client = getPusherClient();

    if (!client) {
      return false;
    }

    Reflect.set(client, property, value, client);

    return true;
  },
});