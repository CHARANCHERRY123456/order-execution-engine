// import WebSocket  from "ws";
import WebSocket from "ws";

class WebSocketManager {
    private connections = new Map<string, Set<WebSocket>>();

    add(orderId: string, socket: WebSocket) {
        if (!this.connections.has(orderId)) {
            this.connections.set(orderId, new Set());
        }
        this.connections.get(orderId)!.add(socket);
    }

    remove(orderId: string, socket: WebSocket) {
        this.connections.get(orderId)?.delete(socket);
    }

    emit(orderId: string, payload: unknown) {
    const sockets = this.connections.get(orderId);
    if (!sockets) return;

    const message = JSON.stringify(payload);

    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    }
  }
}

export const wsManager = new WebSocketManager();