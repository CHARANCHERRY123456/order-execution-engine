import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { FastifyInstance } from "fastify";

// Mock the queue and worker before importing the app
vi.mock("../../src/modules/orders/queue/order.queue", () => ({
    orderQueue: {
        add: vi.fn().mockResolvedValue({ id: "job-123" })
    }
}));

// Mock the worker to prevent it from starting
vi.mock("../../src/modules/orders/queue/order.worker", () => ({
    orderWorker: {}
}));

// Now import buildApp after mocks are set up
const { buildApp } = await import("../../src/app");

describe("Order Execution API", () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    describe("POST /api/orders/execute", () => {
        it("returns 200 with orderId for valid request", async () => {
            const response = await app.inject({
                method: "POST",
                url: "/api/orders/execute",
                payload: {
                    tokenIn: "SOL",
                    tokenOut: "USDC",
                    amount: 1,
                    slippage: 0.01
                }
            });

            expect(response.statusCode).toBe(200);
            
            const body = JSON.parse(response.body);
            expect(body).toHaveProperty("orderId");
            expect(typeof body.orderId).toBe("string");
            expect(body.orderId.length).toBeGreaterThan(0);
        });

        it("returns order details in response", async () => {
            const orderData = {
                tokenIn: "ETH",
                tokenOut: "USDT",
                amount: 2.5,
                slippage: 0.02
            };

            const response = await app.inject({
                method: "POST",
                url: "/api/orders/execute",
                payload: orderData
            });

            const body = JSON.parse(response.body);
            expect(body.order).toEqual(orderData);
        });

        it("returns 400 when tokenIn is missing", async () => {
            const response = await app.inject({
                method: "POST",
                url: "/api/orders/execute",
                payload: {
                    tokenOut: "USDC",
                    amount: 1
                }
            });

            expect(response.statusCode).toBe(400);
            
            const body = JSON.parse(response.body);
            expect(body).toHaveProperty("error");
            expect(body.error).toContain("Missing required fields");
        });

        it("returns 400 when tokenOut is missing", async () => {
            const response = await app.inject({
                method: "POST",
                url: "/api/orders/execute",
                payload: {
                    tokenIn: "SOL",
                    amount: 1
                }
            });

            expect(response.statusCode).toBe(400);
            
            const body = JSON.parse(response.body);
            expect(body).toHaveProperty("error");
        });

        it("returns 400 when amount is missing", async () => {
            const response = await app.inject({
                method: "POST",
                url: "/api/orders/execute",
                payload: {
                    tokenIn: "SOL",
                    tokenOut: "USDC"
                }
            });

            expect(response.statusCode).toBe(400);
            
            const body = JSON.parse(response.body);
            expect(body).toHaveProperty("error");
        });

        it("returns 400 when amount is zero", async () => {
            const response = await app.inject({
                method: "POST",
                url: "/api/orders/execute",
                payload: {
                    tokenIn: "SOL",
                    tokenOut: "USDC",
                    amount: 0
                }
            });

            expect(response.statusCode).toBe(400);
            
            const body = JSON.parse(response.body);
            expect(body.error).toContain("Amount must be greater than 0");
        });

        it("returns 400 when amount is negative", async () => {
            const response = await app.inject({
                method: "POST",
                url: "/api/orders/execute",
                payload: {
                    tokenIn: "SOL",
                    tokenOut: "USDC",
                    amount: -1
                }
            });

            expect(response.statusCode).toBe(400);
            
            const body = JSON.parse(response.body);
            expect(body.error).toContain("Amount must be greater than 0");
        });

        it("uses default slippage of 1% when not provided", async () => {
            const response = await app.inject({
                method: "POST",
                url: "/api/orders/execute",
                payload: {
                    tokenIn: "SOL",
                    tokenOut: "USDC",
                    amount: 1
                }
            });

            const body = JSON.parse(response.body);
            expect(body.order.slippage).toBe(0.01);
        });

        it("accepts custom slippage values", async () => {
            const response = await app.inject({
                method: "POST",
                url: "/api/orders/execute",
                payload: {
                    tokenIn: "SOL",
                    tokenOut: "USDC",
                    amount: 1,
                    slippage: 0.05
                }
            });

            const body = JSON.parse(response.body);
            expect(body.order.slippage).toBe(0.05);
        });

        it("handles decimal amounts correctly", async () => {
            const response = await app.inject({
                method: "POST",
                url: "/api/orders/execute",
                payload: {
                    tokenIn: "SOL",
                    tokenOut: "USDC",
                    amount: 0.123456
                }
            });

            expect(response.statusCode).toBe(200);
            
            const body = JSON.parse(response.body);
            expect(body.order.amount).toBe(0.123456);
        });

        it("handles large amounts", async () => {
            const response = await app.inject({
                method: "POST",
                url: "/api/orders/execute",
                payload: {
                    tokenIn: "SOL",
                    tokenOut: "USDC",
                    amount: 1000000
                }
            });

            expect(response.statusCode).toBe(200);
            
            const body = JSON.parse(response.body);
            expect(body.order.amount).toBe(1000000);
        });

        it("handles various token pairs", async () => {
            const tokenPairs = [
                { tokenIn: "SOL", tokenOut: "USDC" },
                { tokenIn: "ETH", tokenOut: "USDT" },
                { tokenIn: "BTC", tokenOut: "DAI" },
                { tokenIn: "BONK", tokenOut: "SOL" }
            ];

            for (const pair of tokenPairs) {
                const response = await app.inject({
                    method: "POST",
                    url: "/api/orders/execute",
                    payload: {
                        ...pair,
                        amount: 1
                    }
                });

                expect(response.statusCode).toBe(200);
                
                const body = JSON.parse(response.body);
                expect(body.order.tokenIn).toBe(pair.tokenIn);
                expect(body.order.tokenOut).toBe(pair.tokenOut);
            }
        });

        it("generates unique orderIds for concurrent requests", async () => {
            const requests = Array.from({ length: 5 }, () =>
                app.inject({
                    method: "POST",
                    url: "/api/orders/execute",
                    payload: {
                        tokenIn: "SOL",
                        tokenOut: "USDC",
                        amount: 1
                    }
                })
            );

            const responses = await Promise.all(requests);
            const orderIds = responses.map(r => JSON.parse(r.body).orderId);

            // All orderIds should be unique
            const uniqueIds = new Set(orderIds);
            expect(uniqueIds.size).toBe(5);
        });

        it("returns 400 for empty body with Content-Type application/json", async () => {
            const response = await app.inject({
                method: "POST",
                url: "/api/orders/execute",
                headers: {
                    "Content-Type": "application/json"
                },
                payload: ""
            });

            expect(response.statusCode).toBe(400);
        });
    });

    describe("GET /health", () => {
        it("returns 200 with status ok", async () => {
            const response = await app.inject({
                method: "GET",
                url: "/health"
            });

            expect(response.statusCode).toBe(200);
            
            const body = JSON.parse(response.body);
            expect(body.status).toBe("ok");
        });
    });

    describe("Edge Cases", () => {
        it("handles very small amounts", async () => {
            const response = await app.inject({
                method: "POST",
                url: "/api/orders/execute",
                payload: {
                    tokenIn: "SOL",
                    tokenOut: "USDC",
                    amount: 0.000001
                }
            });

            expect(response.statusCode).toBe(200);
        });

        it("handles high slippage values", async () => {
            const response = await app.inject({
                method: "POST",
                url: "/api/orders/execute",
                payload: {
                    tokenIn: "SOL",
                    tokenOut: "USDC",
                    amount: 1,
                    slippage: 0.99  // 99% slippage
                }
            });

            expect(response.statusCode).toBe(200);
            
            const body = JSON.parse(response.body);
            expect(body.order.slippage).toBe(0.99);
        });

        it("handles string token names with special characters", async () => {
            const response = await app.inject({
                method: "POST",
                url: "/api/orders/execute",
                payload: {
                    tokenIn: "SOL-USDC-LP",
                    tokenOut: "USDC.e",
                    amount: 1
                }
            });

            expect(response.statusCode).toBe(200);
        });
    });
});
