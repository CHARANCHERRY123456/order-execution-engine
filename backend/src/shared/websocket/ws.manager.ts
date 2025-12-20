// import WebSocket  from "ws";
import WebSocket from 'ws';

class WebSocketManager {
  // orderId => Set of WebSocket connections
  private connections = new Map<string, Set<WebSocket>>();
  // orderId => last emitted state
  private lastState = new Map<string, unknown>();

  add(orderId: string, socket: WebSocket) {
    if (!this.connections.has(orderId)) {
      this.connections.set(orderId, new Set());
    }
    this.connections.get(orderId)!.add(socket);

    const last = this.lastState.get(orderId);
    if (last && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(last));
      } catch (err) {
        // ignore send errors for now
      }
    }
  }

  remove(orderId: string, socket: WebSocket) {
    this.connections.get(orderId)?.delete(socket);
  }

  emit(orderId: string, payload: unknown) {
    this.lastState.set(orderId, payload);

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