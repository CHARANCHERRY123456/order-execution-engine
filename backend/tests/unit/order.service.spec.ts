import { describe, it, expect, beforeEach, vi } from "vitest";
import { OrderInput } from "../../src/modules/orders/dex/dex.types";

// Mock the queue before importing OrderService
vi.mock("../../src/modules/orders/queue/order.queue", () => ({
    orderQueue: {
        add: vi.fn().mockResolvedValue({ id: "job-123" })
    }
}));

// Now import after mocking
const { OrderService } = await import("../../src/modules/orders/order.service");

describe("Order Service", () => {
    let service: OrderService;

    beforeEach(() => {
        service = new OrderService();
        vi.clearAllMocks();
    });

    describe("executeOrder", () => {
        it("returns an orderId", async () => {
            const orderData: OrderInput = {
                tokenIn: "SOL",
                tokenOut: "USDC",
                amount: 1,
                slippage: 0.01
            };

            const result = await service.executeOrder(orderData);

            expect(result).toHaveProperty("orderId");
            expect(typeof result.orderId).toBe("string");
        });

        it("generates unique orderIds for each order", async () => {
            const orderData: OrderInput = {
                tokenIn: "SOL",
                tokenOut: "USDC",
                amount: 1,
                slippage: 0.01
            };

            const result1 = await service.executeOrder(orderData);
            const result2 = await service.executeOrder(orderData);

            expect(result1.orderId).not.toBe(result2.orderId);
        });

        it("returns the order data in response", async () => {
            const orderData: OrderInput = {
                tokenIn: "SOL",
                tokenOut: "USDC",
                amount: 1.5,
                slippage: 0.02
            };

            const result = await service.executeOrder(orderData);

            expect(result.order).toEqual(orderData);
        });

        it("handles different token pairs", async () => {
            const orderData: OrderInput = {
                tokenIn: "ETH",
                tokenOut: "USDT",
                amount: 2,
                slippage: 0.01
            };

            const result = await service.executeOrder(orderData);

            expect(result.orderId).toBeDefined();
            expect(result.order.tokenIn).toBe("ETH");
            expect(result.order.tokenOut).toBe("USDT");
        });

        it("handles various amounts", async () => {
            const amounts = [0.1, 1, 10, 100, 1000];

            for (const amount of amounts) {
                const orderData: OrderInput = {
                    tokenIn: "SOL",
                    tokenOut: "USDC",
                    amount,
                    slippage: 0.01
                };

                const result = await service.executeOrder(orderData);

                expect(result.order.amount).toBe(amount);
            }
        });

        it("handles different slippage values", async () => {
            const slippages = [0.001, 0.005, 0.01, 0.05, 0.1];

            for (const slippage of slippages) {
                const orderData: OrderInput = {
                    tokenIn: "SOL",
                    tokenOut: "USDC",
                    amount: 1,
                    slippage
                };

                const result = await service.executeOrder(orderData);

                expect(result.order.slippage).toBe(slippage);
            }
        });
    });
});
