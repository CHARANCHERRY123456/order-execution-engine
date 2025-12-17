import WebSocket  from "@fastify/websocket";

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

    emit(orderId: string, message: string) {
        const sockets = this.connections.get(orderId);
        if(!sockets) return;
        for (const socket of sockets) {
            socket.send(message);
        }
    }
}

export const wsManager = new WebSocketManager();