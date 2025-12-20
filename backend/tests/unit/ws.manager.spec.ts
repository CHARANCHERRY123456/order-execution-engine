import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

class MockWebSocket {
    readyState = 1; // OPEN
    send = vi.fn();
    on = vi.fn();
    close = vi.fn();
    
    static OPEN = 1;
    static CLOSED = 3;
}

// Import after setting up the mock
const { wsManager } = await import("../../src/shared/websocket/ws.manager");

describe("WebSocket Manager", () => {
    let socket1: MockWebSocket;
    let socket2: MockWebSocket;
    const orderId = "test-order-123";

    beforeEach(() => {
        // Create mock sockets
        socket1 = new MockWebSocket();
        socket2 = new MockWebSocket();
        
        // Clear any previous state
        (wsManager as any).connections.clear();
        (wsManager as any).lastState.clear();
        
        // Reset all mocks
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Clean up
        (wsManager as any).connections.clear();
        (wsManager as any).lastState.clear();
    });

    describe("add", () => {
        it("registers a new connection for an orderId", () => {
            wsManager.add(orderId, socket1 as any);

            const connections = (wsManager as any).connections.get(orderId);
            expect(connections).toBeDefined();
            expect(connections.has(socket1)).toBe(true);
        });

        it("allows multiple connections for the same orderId", () => {
            wsManager.add(orderId, socket1 as any);
            wsManager.add(orderId, socket2 as any);

            const connections = (wsManager as any).connections.get(orderId);
            expect(connections.size).toBe(2);
            expect(connections.has(socket1)).toBe(true);
            expect(connections.has(socket2)).toBe(true);
        });

        it("sends last known state to new connections", () => {
            const state = { orderId, state: "pending" };
            wsManager.emit(orderId, state);

            wsManager.add(orderId, socket1 as any);

            expect(socket1.send).toHaveBeenCalledWith(JSON.stringify(state));
        });

        it("does not send anything if no previous state exists", () => {
            wsManager.add(orderId, socket1 as any);

            expect(socket1.send).not.toHaveBeenCalled();
        });

        it("handles multiple orderIds independently", () => {
            const orderId1 = "order-1";
            const orderId2 = "order-2";

            wsManager.add(orderId1, socket1 as any);
            wsManager.add(orderId2, socket2 as any);

            const connections1 = (wsManager as any).connections.get(orderId1);
            const connections2 = (wsManager as any).connections.get(orderId2);

            expect(connections1.has(socket1)).toBe(true);
            expect(connections1.has(socket2)).toBe(false);
            expect(connections2.has(socket2)).toBe(true);
            expect(connections2.has(socket1)).toBe(false);
        });
    });

    describe("remove", () => {
        it("removes a connection from orderId", () => {
            wsManager.add(orderId, socket1 as any);
            wsManager.remove(orderId, socket1 as any);

            const connections = (wsManager as any).connections.get(orderId);
            expect(connections.has(socket1)).toBe(false);
        });

        it("keeps other connections when removing one", () => {
            wsManager.add(orderId, socket1 as any);
            wsManager.add(orderId, socket2 as any);
            wsManager.remove(orderId, socket1 as any);

            const connections = (wsManager as any).connections.get(orderId);
            expect(connections.has(socket1)).toBe(false);
            expect(connections.has(socket2)).toBe(true);
        });

        it("handles removing non-existent connection gracefully", () => {
            expect(() => {
                wsManager.remove("non-existent-order", socket1 as any);
            }).not.toThrow();
        });
    });

    describe("emit", () => {
        it("sends message to all connected sockets", () => {
            wsManager.add(orderId, socket1 as any);
            wsManager.add(orderId, socket2 as any);

            const payload = { orderId, state: "routing" };
            wsManager.emit(orderId, payload);

            expect(socket1.send).toHaveBeenCalledWith(JSON.stringify(payload));
            expect(socket2.send).toHaveBeenCalledWith(JSON.stringify(payload));
        });

        it("caches the last state", () => {
            const payload = { orderId, state: "building" };
            wsManager.emit(orderId, payload);

            const lastState = (wsManager as any).lastState.get(orderId);
            expect(lastState).toEqual(payload);
        });

        it("does not send to non-existent orderId", () => {
            wsManager.emit("non-existent-order", { test: true });

            expect(socket1.send).not.toHaveBeenCalled();
        });

        it("only sends to sockets with OPEN readyState", () => {
            wsManager.add(orderId, socket1 as any);
            wsManager.add(orderId, socket2 as any);

            // Close socket2
            (socket2 as any).readyState = MockWebSocket.CLOSED;

            const payload = { orderId, state: "submitted" };
            wsManager.emit(orderId, payload);

            expect(socket1.send).toHaveBeenCalledWith(JSON.stringify(payload));
            expect(socket2.send).not.toHaveBeenCalled();
        });

        it("handles multiple state updates", () => {
            wsManager.add(orderId, socket1 as any);

            const states = ["pending", "routing", "building", "submitted", "confirmed"];
            
            states.forEach(state => {
                wsManager.emit(orderId, { orderId, state });
            });

            expect(socket1.send).toHaveBeenCalledTimes(5);
            
            const lastState = (wsManager as any).lastState.get(orderId);
            expect(lastState.state).toBe("confirmed");
        });

        it("serializes complex payloads correctly", () => {
            wsManager.add(orderId, socket1 as any);

            const complexPayload = {
                orderId,
                state: "confirmed",
                txHash: "abc123",
                details: {
                    price: 99.50,
                    amount: 1.5,
                    dex: "Raydium"
                }
            };

            wsManager.emit(orderId, complexPayload);

            expect(socket1.send).toHaveBeenCalledWith(JSON.stringify(complexPayload));
        });
    });

    describe("State Caching", () => {
        it("late joiners receive current state immediately", () => {
            // First connection emits some updates
            wsManager.add(orderId, socket1 as any);
            wsManager.emit(orderId, { orderId, state: "routing" });
            wsManager.emit(orderId, { orderId, state: "building" });

            // Late joiner connects
            const socket3 = new MockWebSocket();
            wsManager.add(orderId, socket3 as any);

            // Should receive the last state
            expect(socket3.send).toHaveBeenCalledWith(
                JSON.stringify({ orderId, state: "building" })
            );
        });

        it("maintains separate state for different orderIds", () => {
            const orderId1 = "order-1";
            const orderId2 = "order-2";

            wsManager.emit(orderId1, { orderId: orderId1, state: "routing" });
            wsManager.emit(orderId2, { orderId: orderId2, state: "confirmed" });

            const state1 = (wsManager as any).lastState.get(orderId1);
            const state2 = (wsManager as any).lastState.get(orderId2);

            expect(state1.state).toBe("routing");
            expect(state2.state).toBe("confirmed");
        });
    });
});
