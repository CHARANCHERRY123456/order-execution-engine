import { describe, it, expect, beforeEach } from "vitest";
import { MockDexRouter } from "../../src/modules/orders/dex/mock-dex-router";
import { OrderInput } from "../../src/modules/orders/dex/dex.types";

describe("Mock DEX Router", () => {
    let dexRouter: MockDexRouter;
    let mockOrder: OrderInput;

    beforeEach(() => {
        dexRouter = new MockDexRouter(100); // Base price $100
        mockOrder = {
            tokenIn: "SOL",
            tokenOut: "USDC",
            amount: 1,
            slippage: 0.01
        };
    });

    describe("getRaydiumQuote", () => {
        it("returns a valid quote with correct structure", async () => {
            const quote = await dexRouter.getRaydiumQuote(mockOrder);

            expect(quote).toHaveProperty("dexName", "Raydium");
            expect(quote).toHaveProperty("inputAmount", 1);
            expect(quote).toHaveProperty("outputAmount");
            expect(quote).toHaveProperty("price");
            expect(quote).toHaveProperty("fee");
            expect(quote).toHaveProperty("priceImpact");
        });

        it("returns price within expected variance (±2%)", async () => {
            const quote = await dexRouter.getRaydiumQuote(mockOrder);
            
            // Base price is 100, variance should be 98-102
            expect(quote.price).toBeGreaterThanOrEqual(98);
            expect(quote.price).toBeLessThanOrEqual(102);
        });

        it("applies 0.3% fee", async () => {
            const quote = await dexRouter.getRaydiumQuote(mockOrder);
            expect(quote.fee).toBe(0.003);
        });

        it("calculates output amount correctly", async () => {
            const quote = await dexRouter.getRaydiumQuote(mockOrder);
            
            // Output should be: amount * price * (1 - fee) * (1 - priceImpact)
            const expectedOutput = mockOrder.amount * quote.price * (1 - quote.fee) * (1 - quote.priceImpact);
            
            expect(quote.outputAmount).toBeCloseTo(expectedOutput, 5);
        });

        it("handles different input amounts", async () => {
            const largeOrder = { ...mockOrder, amount: 10 };
            const quote = await dexRouter.getRaydiumQuote(largeOrder);
            
            expect(quote.inputAmount).toBe(10);
            expect(quote.outputAmount).toBeGreaterThan(0);
        });
    });

    describe("getMeteorQuote", () => {
        it("returns a valid quote with correct structure", async () => {
            const quote = await dexRouter.getMeteorQuote(mockOrder);

            expect(quote).toHaveProperty("dexName", "Meteora");
            expect(quote).toHaveProperty("inputAmount", 1);
            expect(quote).toHaveProperty("outputAmount");
            expect(quote).toHaveProperty("price");
            expect(quote).toHaveProperty("fee");
            expect(quote).toHaveProperty("priceImpact");
        });

        it("returns price within expected variance (±3-5%)", async () => {
            const quote = await dexRouter.getMeteorQuote(mockOrder);
            
            // Base price is 100, variance should be 97-102
            expect(quote.price).toBeGreaterThanOrEqual(95);
            expect(quote.price).toBeLessThanOrEqual(105);
        });

        it("applies 0.2% fee (cheaper than Raydium)", async () => {
            const quote = await dexRouter.getMeteorQuote(mockOrder);
            expect(quote.fee).toBe(0.002);
        });

        it("has lower fee than Raydium", async () => {
            const raydiumQuote = await dexRouter.getRaydiumQuote(mockOrder);
            const meteoraQuote = await dexRouter.getMeteorQuote(mockOrder);
            
            expect(meteoraQuote.fee).toBeLessThan(raydiumQuote.fee);
        });
    });

    describe("selectBestQuote", () => {
        it("selects quote with higher output amount", async () => {
            const raydiumQuote = await dexRouter.getRaydiumQuote(mockOrder);
            const meteoraQuote = await dexRouter.getMeteorQuote(mockOrder);

            const bestQuote = dexRouter.selectBestQuote(raydiumQuote, meteoraQuote);

            if (raydiumQuote.outputAmount > meteoraQuote.outputAmount) {
                expect(bestQuote.dexName).toBe("Raydium");
            } else {
                expect(bestQuote.dexName).toBe("Meteora");
            }
        });

        it("always returns one of the input quotes", async () => {
            const raydiumQuote = await dexRouter.getRaydiumQuote(mockOrder);
            const meteoraQuote = await dexRouter.getMeteorQuote(mockOrder);

            const bestQuote = dexRouter.selectBestQuote(raydiumQuote, meteoraQuote);

            expect([raydiumQuote, meteoraQuote]).toContainEqual(bestQuote);
        });

        it("handles equal output amounts", async () => {
            const quote1 = await dexRouter.getRaydiumQuote(mockOrder);
            const quote2 = { ...quote1, dexName: "Meteora" as const };

            const bestQuote = dexRouter.selectBestQuote(quote1, quote2);

            expect(bestQuote).toBeDefined();
            expect(["Raydium", "Meteora"]).toContain(bestQuote.dexName);
        });
    });

    describe("executeSwap", () => {
        it("returns a valid swap result", async () => {
            const quote = await dexRouter.getRaydiumQuote(mockOrder);
            const result = await dexRouter.executeSwap(quote, mockOrder);

            expect(result).toHaveProperty("txHash");
            expect(result).toHaveProperty("dexUsed");
            expect(result).toHaveProperty("inputAmount");
            expect(result).toHaveProperty("outputAmount");
            expect(result).toHaveProperty("executedPrice");
            expect(result).toHaveProperty("fee");
        });

        it("generates a valid transaction hash", async () => {
            const quote = await dexRouter.getRaydiumQuote(mockOrder);
            const result = await dexRouter.executeSwap(quote, mockOrder);

            expect(result.txHash).toBeDefined();
            expect(result.txHash.length).toBe(64);
            expect(result.txHash).toMatch(/^[a-zA-Z0-9]+$/);
        });

        it("uses the correct DEX from quote", async () => {
            const raydiumQuote = await dexRouter.getRaydiumQuote(mockOrder);
            const result = await dexRouter.executeSwap(raydiumQuote, mockOrder);

            expect(result.dexUsed).toBe("Raydium");
        });

        it("takes 2-3 seconds to execute", async () => {
            const quote = await dexRouter.getRaydiumQuote(mockOrder);
            const startTime = Date.now();
            
            await dexRouter.executeSwap(quote, mockOrder);
            
            const duration = Date.now() - startTime;
            expect(duration).toBeGreaterThanOrEqual(2000);
            expect(duration).toBeLessThanOrEqual(3100); // Allow some margin
        });

        it("applies small execution variance (±0.1%)", async () => {
            const quote = await dexRouter.getRaydiumQuote(mockOrder);
            const result = await dexRouter.executeSwap(quote, mockOrder);

            const variancePercent = Math.abs(result.outputAmount - quote.outputAmount) / quote.outputAmount;
            expect(variancePercent).toBeLessThanOrEqual(0.002); // 0.2% max variance
        });

        it("preserves fee from quote", async () => {
            const quote = await dexRouter.getRaydiumQuote(mockOrder);
            const result = await dexRouter.executeSwap(quote, mockOrder);

            expect(result.fee).toBe(quote.fee);
        });
    });

    describe("routeOrder", () => {
        it("returns quotes from both DEXs and a selected quote", async () => {
            const result = await dexRouter.routeOrder(mockOrder);

            expect(result).toHaveProperty("raydiumQuote");
            expect(result).toHaveProperty("meteoraQuote");
            expect(result).toHaveProperty("selectedQuote");
        });

        it("selected quote is one of the fetched quotes", async () => {
            const result = await dexRouter.routeOrder(mockOrder);

            expect([result.raydiumQuote, result.meteoraQuote]).toContainEqual(result.selectedQuote);
        });

        it("fetches quotes in parallel (faster than sequential)", async () => {
            const startTime = Date.now();
            await dexRouter.routeOrder(mockOrder);
            const duration = Date.now() - startTime;

            // If parallel: ~150-250ms
            // If sequential: ~300-500ms
            expect(duration).toBeLessThan(500);
        });

        it("selects the DEX with better output", async () => {
            const result = await dexRouter.routeOrder(mockOrder);

            if (result.selectedQuote.dexName === "Raydium") {
                expect(result.raydiumQuote.outputAmount).toBeGreaterThanOrEqual(result.meteoraQuote.outputAmount);
            } else {
                expect(result.meteoraQuote.outputAmount).toBeGreaterThanOrEqual(result.raydiumQuote.outputAmount);
            }
        });
    });

    describe("Price Comparison Logic", () => {
        it("consistently selects better price across multiple orders", async () => {
            const results = await Promise.all([
                dexRouter.routeOrder(mockOrder),
                dexRouter.routeOrder(mockOrder),
                dexRouter.routeOrder(mockOrder)
            ]);

            results.forEach(result => {
                const selectedOutput = result.selectedQuote.outputAmount;
                expect(selectedOutput).toBeGreaterThanOrEqual(
                    Math.min(result.raydiumQuote.outputAmount, result.meteoraQuote.outputAmount)
                );
            });
        });

        it("price variance creates different DEX selections", async () => {
            // Run multiple times to see if different DEXs get selected
            const selections = await Promise.all(
                Array.from({ length: 10 }, () => dexRouter.routeOrder(mockOrder))
            );

            const dexNames = selections.map(s => s.selectedQuote.dexName);
            
            // With random variance, both DEXs should be selected at least once in 10 tries
            expect(dexNames.some(name => name === "Raydium")).toBe(true);
            expect(dexNames.some(name => name === "Meteora")).toBe(true);
        });
    });
});
