// import WebSocket  from "ws";
import WebSocket from 'ws';

class WebSocketManager {
  // orderId => Set of WebSocket connections
  private connections = new Map<string, Set<WebSocket>>();
  // orderId => array of all state updates (state history)
  private stateHistory = new Map<string, unknown[]>();
  // backward-compatible cache of the last state per orderId
  // backward-compatible cache of the last state per orderId
  // Implement as a Map-like wrapper so `.clear()` can also clear `stateHistory`
  private lastState: any;

  constructor() {
    // Initialize lastState as a Map-like wrapper that keeps stateHistory in sync on clear
    this.lastState = (() => {
      const internal = new Map<string, unknown>();
      return {
        get: (k: string) => internal.get(k),
        set: (k: string, v: unknown) => internal.set(k, v),
        has: (k: string) => internal.has(k),
        clear: () => {
          internal.clear();
          this.stateHistory.clear();
        },
        // expose size and other Map-like utilities if needed
        get size() { return internal.size; }
      };
    })();
  }


  add(orderId: string, socket: WebSocket) {
    if (!this.connections.has(orderId)) {
      this.connections.set(orderId, new Set());
    }
    this.connections.get(orderId)!.add(socket);

    // Send entire state history to late joiner
    const history = this.stateHistory.get(orderId) || [];
    if (history.length > 0 && socket.readyState === WebSocket.OPEN) {
      try {
        // Send all previous states in order
        history.forEach(state => {
          socket.send(JSON.stringify(state));
        });
      } catch (err) {
        // ignore send errors for now
      }
    }
    // If no history but we have a lastState (back-compat), send it once
    if (history.length === 0) {
      const last = this.lastState.get(orderId);
      if (last && socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify(last));
        } catch (err) {
          // ignore
        }
      }
    }
  }

  remove(orderId: string, socket: WebSocket) {
    this.connections.get(orderId)?.delete(socket);
  }

  emit(orderId: string, payload: unknown) {
    // Add to history
    if (!this.stateHistory.has(orderId)) {
      this.stateHistory.set(orderId, []);
    }
    this.stateHistory.get(orderId)!.push(payload);
    // Update lastState cache for backward-compatible tests and consumers
    this.lastState.set(orderId, payload);

    // Broadcast to all connected clients
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