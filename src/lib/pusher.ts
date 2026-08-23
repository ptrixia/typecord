import PusherServer from "pusher";
import PusherClient from "pusher-js";

// Usado no Backend (Server Actions)
export const pusherServer = new PusherServer({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: "sa1", // Cluster da América do Sul
  useTLS: true,
});

// Usado no Frontend (Client Components)
export const pusherClient = new PusherClient(
  process.env.NEXT_PUBLIC_PUSHER_KEY!,
  { cluster: "sa1" }
);