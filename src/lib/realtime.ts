import "server-only";

import { createServer, type IncomingMessage, type Server as HttpServer } from "node:http";
import { parse } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { onTransactionCommit, queryOne } from "@/lib/mysql";
import type { Notification } from "@/lib/types";

const realtimePort = Number(process.env.REALTIME_PORT || 3002);
const sessionCookieName = "glyph_session";
const realtimeVersion = 4;

type SessionLookupRow = RowDataPacket & {
  user_id: string;
};

type RealtimeClient = {
  socket: WebSocket;
  userId: string;
  activeConversationId: string | null;
};

type RealtimeState = {
  clients: Set<RealtimeClient>;
  httpServer: HttpServer;
  wsServer: WebSocketServer;
  port: number;
  version: number;
};

export type RealtimeEvent =
  | {
      type: "notification:new";
      recipients: string[];
      payload: {
        item: Notification;
      };
    }
  | {
      type: "feed:changed";
      payload: {
        reason:
          | "post-created"
          | "post-deleted"
          | "post-liked"
          | "comment-created"
          | "repost-created"
          | "vote-cast"
          | "clan-updated";
        postId?: string;
        actorId?: string;
      };
    }
  | {
      type: "profile:changed";
      recipients: string[];
      payload: {
        userId: string;
      };
    }
  | {
      type: "message:new";
      recipients: string[];
      payload: {
        conversationId: string;
        messageId: string;
        senderId: string;
      };
    }
  | {
      type: "message:changed";
      recipients: string[];
      payload: {
        conversationId: string;
        messageId: string;
      };
    }
  | {
      type: "message:typing";
      recipients: string[];
      payload: {
        conversationId: string;
        senderId: string;
      };
    };

declare global {
  var __glyphRealtimeState: RealtimeState | undefined;
}

function getCookieValue(rawCookieHeader: string | undefined, name: string) {
  if (!rawCookieHeader) {
    return null;
  }

  for (const part of rawCookieHeader.split(";")) {
    const [cookieName, ...cookieValue] = part.trim().split("=");

    if (cookieName === name) {
      return decodeURIComponent(cookieValue.join("="));
    }
  }

  return null;
}

async function getUserIdFromSessionToken(token: string | null) {
  if (!token) {
    return null;
  }

  const session = await queryOne<SessionLookupRow>(
    `SELECT user_id
     FROM sessions
     WHERE token = ? AND expires_at > NOW(3)`,
    [token],
  );

  return session?.user_id ?? null;
}

function serializeEvent(event: RealtimeEvent) {
  return JSON.stringify({
    type: event.type,
    payload: event.payload,
  });
}

function emitToClients(state: RealtimeState, predicate: (client: RealtimeClient) => boolean, event: RealtimeEvent) {
  const message = serializeEvent(event);

  for (const client of state.clients) {
    if (!predicate(client)) {
      continue;
    }

    if (client.socket.readyState !== client.socket.OPEN) {
      continue;
    }

    client.socket.send(message);
  }
}

function getRealtimeState() {
  return globalThis.__glyphRealtimeState;
}

export async function ensureRealtimeServer() {
  const existing = getRealtimeState();

  if (existing?.version === realtimeVersion) {
    return existing;
  }

  if (existing) {
    for (const client of existing.clients) {
      client.socket.close();
    }

    existing.wsServer.close();
    await new Promise<void>((resolve) => existing.httpServer.close(() => resolve()));
    globalThis.__glyphRealtimeState = undefined;
  }

  const clients = new Set<RealtimeClient>();
  const httpServer = createServer();
  const wsServer = new WebSocketServer({ noServer: true });

  wsServer.on("connection", (socket: WebSocket, _request: IncomingMessage, userId: string) => {
    const client: RealtimeClient = { socket, userId, activeConversationId: null };
    clients.add(client);

    socket.send(
      JSON.stringify({
        type: "socket:ready",
        payload: { userId },
      }),
    );

    socket.on("close", () => {
      clients.delete(client);
    });

    socket.on("message", (rawMessage) => {
      try {
        const event = JSON.parse(rawMessage.toString()) as {
          type?: string;
          payload?: {
            conversationId?: string;
            recipientId?: string;
          };
        };

        if (event.type === "message:conversation-active") {
          client.activeConversationId = event.payload?.conversationId || null;
          return;
        }

        if (event.type !== "message:typing" || !event.payload?.conversationId || !event.payload.recipientId) {
          return;
        }

        emitToClients(
          { clients, httpServer, wsServer, port: realtimePort, version: realtimeVersion },
          (entry) => entry.userId === event.payload?.recipientId,
          {
            type: "message:typing",
            recipients: [event.payload.recipientId],
            payload: {
              conversationId: event.payload.conversationId,
              senderId: userId,
            },
          },
        );
      } catch {
        return;
      }
    });

    socket.on("error", () => {
      clients.delete(client);
    });
  });

  httpServer.on("upgrade", async (request, socket, head) => {
    const pathname = parse(request.url || "").pathname;

    if (pathname !== "/ws") {
      socket.destroy();
      return;
    }

    const token = getCookieValue(request.headers.cookie, sessionCookieName);
    const userId = await getUserIdFromSessionToken(token);

    if (!userId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wsServer.handleUpgrade(request, socket, head, (upgradedSocket: WebSocket) => {
      wsServer.emit("connection", upgradedSocket, request, userId);
    });
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(realtimePort, "0.0.0.0", () => {
      httpServer.off("error", reject);
      resolve();
    });
  });

  const state: RealtimeState = {
    clients,
    httpServer,
    wsServer,
    port: realtimePort,
    version: realtimeVersion,
  };

  globalThis.__glyphRealtimeState = state;
  return state;
}

export async function emitRealtimeEvent(event: RealtimeEvent) {
  const state = await ensureRealtimeServer();

  if (event.type === "notification:new") {
    emitToClients(state, (client) => event.recipients.includes(client.userId), event);
    return;
  }

  if (event.type === "profile:changed") {
    emitToClients(state, (client) => event.recipients.includes(client.userId), event);
    return;
  }

  if (event.type === "message:new" || event.type === "message:changed" || event.type === "message:typing") {
    emitToClients(state, (client) => event.recipients.includes(client.userId), event);
    return;
  }

  emitToClients(state, () => true, event);
}

export function queueRealtimeEvent(connection: PoolConnection, event: RealtimeEvent) {
  onTransactionCommit(connection, async () => {
    await emitRealtimeEvent(event);
  });
}

export async function isUserViewingConversation(userId: string, conversationId: string) {
  const state = await ensureRealtimeServer();

  for (const client of state.clients) {
    if (
      client.userId === userId &&
      client.activeConversationId === conversationId &&
      client.socket.readyState === client.socket.OPEN
    ) {
      return true;
    }
  }

  return false;
}

export async function getRealtimeConnectionUrl(request: Request) {
  if (process.env.NEXT_PUBLIC_REALTIME_URL) {
    return process.env.NEXT_PUBLIC_REALTIME_URL;
  }

  const state = await ensureRealtimeServer();
  const currentUrl = new URL(request.url);
  const protocol = currentUrl.protocol === "https:" ? "wss:" : "ws:";
  const hostname = currentUrl.hostname;

  return `${protocol}//${hostname}:${state.port}/ws`;
}
