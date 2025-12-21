import { Worker } from 'bullmq';
import { redis } from '../../../config/redis';
import { OrderState } from '../domain/order.state';
import { transitionState } from '../domain/order.state-machine';
import { wsManager } from '../../../shared/websocket/ws.manager';
import { logger } from '../../../config/logger';
import { MockDexRouter } from '../dex/mock-dex-router.js';
import { OrderInput } from '../dex/dex.types.js';

// Initialize DEX router with base price of 100 (e.g., SOL = $100)
const dexRouter = new MockDexRouter(100);

// simple sleep helper and randomized 2-3s delay for demo visibility
const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms));
const randDelay = () => 5000 + Math.floor(Math.random() * 1000);

export const orderWorker = new Worker(
    "order-queue",
    async (job) => {
        const { orderId, orderData } = job.data;
        
        // Default order data if not provided (for backward compatibility)
        const order: OrderInput = orderData || {
            tokenIn: 'SOL',
            tokenOut: 'USDC',
            amount: 1,
            slippage: 0.01
        };
        
        let state = OrderState.PENDING;
        logger.info({ jobId: job.id, orderId }, '[WORKER] Picked up job');
        const attempt = (job.attemptsMade || 0) + 1;
        logger.info({ jobId: job.id, orderId, attempt }, `[WORKER] Attempt ${attempt} of ${job.opts?.attempts ?? 3}`);

        // Emit initial state
        logger.info({ orderId, state }, `[ORDER] orderId=${orderId} state=${state}`);
        wsManager.emit(orderId, { orderId, state });
        // wait 2-3s so transitions are visible in demo recordings
        await sleep(randDelay());

        try {
            // ROUTING: Get quotes from both DEXs and select best
            state = transitionState(state, OrderState.ROUTING);
            logger.info({ orderId, state }, `[ORDER] orderId=${orderId} state=${state}`);
            logger.info({ orderId, tokenIn: order.tokenIn, tokenOut: order.tokenOut }, `[ROUTER] Fetching quotes for ${order.tokenIn} → ${order.tokenOut}`);
            wsManager.emit(orderId, { orderId, state, message: 'Comparing Raydium and Meteora prices...' });

            const { raydiumQuote, meteoraQuote, selectedQuote } = await dexRouter.routeOrder(order);
            
            wsManager.emit(orderId, { 
                orderId, 
                state,
                raydiumPrice: raydiumQuote.price.toFixed(2),
                meteoraPrice: meteoraQuote.price.toFixed(2),
                selectedDex: selectedQuote.dexName
            });
            // pause so reviewer can observe routing decision in logs/WS
            await sleep(randDelay());

            // BUILDING: Create transaction
            state = transitionState(state, OrderState.BUILDING);
            logger.info({ orderId, state, selectedDex: selectedQuote.dexName }, `[ORDER] orderId=${orderId} state=${state}`);
            logger.info({ orderId, selectedDex: selectedQuote.dexName }, `[WORKER] Building transaction on ${selectedQuote.dexName}`);
            wsManager.emit(orderId, { orderId, state, selectedDex: selectedQuote.dexName, message: `Building swap on ${selectedQuote.dexName}...` });
            // pause so building step is visible
            await sleep(randDelay());

            // SUBMITTED: Execute swap
            state = transitionState(state, OrderState.SUBMITTED);
            logger.info({ orderId, state }, `[ORDER] orderId=${orderId} state=${state}`);
            logger.info({ orderId }, '[WORKER] Transaction submitted to blockchain');
            wsManager.emit(orderId, { orderId, state, message: 'Transaction submitted to blockchain...' });
            // small pause before execution (executeSwap itself takes 2-3s)
            await sleep(500);

            const swapResult = await dexRouter.executeSwap(selectedQuote, order);

            // CONFIRMED: Transaction successful
            state = transitionState(state, OrderState.CONFIRMED);
            logger.info({ orderId, state, txHash: swapResult.txHash, dex: swapResult.dexUsed, executedPrice: swapResult.executedPrice }, `[ORDER] orderId=${orderId} state=${state}`);
            logger.info({ orderId, txHash: swapResult.txHash, finalPrice: swapResult.executedPrice }, `[EXECUTION] Swap executed for orderId=${orderId} txHash=${swapResult.txHash} finalPrice=${swapResult.executedPrice}`);

            wsManager.emit(orderId, { orderId, state, txHash: swapResult.txHash, dexUsed: swapResult.dexUsed, inputAmount: swapResult.inputAmount, outputAmount: swapResult.outputAmount.toFixed(2), executedPrice: swapResult.executedPrice.toFixed(2), fee: (swapResult.fee * 100).toFixed(2) + '%' });

            return { orderId, finalState: state, swapResult };

        } catch (error) {
            // Handle errors and transition to FAILED state
            state = OrderState.FAILED;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            logger.error({ 
                jobId: job.id, 
                orderId, 
                error: errorMessage 
            }, 'worker: order failed');
            
            wsManager.emit(orderId, { 
                orderId, 
                state, 
                error: errorMessage,
                message: 'Order execution failed'
            });

            throw error; // Re-throw for BullMQ retry mechanism
        }
    }, {
        connection : redis,
        concurrency : 10,
    }
)