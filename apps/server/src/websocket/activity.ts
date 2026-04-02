import { WebSocketServer, WebSocket } from "ws";

interface ActivityEvent {
  type: string;
  taskId?: string;
  message: string;
  amount?: number;
  timestamp: number;
}

let wss: WebSocketServer | null = null;
const activityLog: ActivityEvent[] = [];

export function setupActivityFeed(wsServer: WebSocketServer) {
  wss = wsServer;

  wss.on("connection", (ws) => {
    // Send recent activity on connect
    ws.send(
      JSON.stringify({
        type: "history",
        events: activityLog.slice(-50),
      })
    );
  });
}

export function emitActivity(event: ActivityEvent) {
  activityLog.push(event);

  // Keep last 200 events
  if (activityLog.length > 200) {
    activityLog.splice(0, activityLog.length - 200);
  }

  if (wss) {
    const data = JSON.stringify(event);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
}

export function getActivityLog(): ActivityEvent[] {
  return activityLog;
}
