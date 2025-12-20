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
        logger.info({ jobId: job.id, orderId, order, state }, 'worker: job started');
        wsManager.emit(orderId, { orderId, state });

        try {
            // ROUTING: Get quotes from both DEXs and select best
            state = transitionState(state, OrderState.ROUTING);
            logger.info({ jobId: job.id, orderId, state }, 'worker: fetching DEX quotes');
            wsManager.emit(orderId, { orderId, state, message: 'Comparing Raydium and Meteora prices...' });

            const { raydiumQuote, meteoraQuote, selectedQuote } = await dexRouter.routeOrder(order);
            
            wsManager.emit(orderId, { 
                orderId, 
                state,
                raydiumPrice: raydiumQuote.price.toFixed(2),
                meteoraPrice: meteoraQuote.price.toFixed(2),
                selectedDex: selectedQuote.dexName
            });

            // BUILDING: Create transaction
            state = transitionState(state, OrderState.BUILDING);
            logger.info({ 
                jobId: job.id, 
                orderId, 
                state, 
                selectedDex: selectedQuote.dexName 
            }, 'worker: building transaction');
            wsManager.emit(orderId, { 
                orderId, 
                state, 
                selectedDex: selectedQuote.dexName,
                message: `Building swap on ${selectedQuote.dexName}...`
            });

            // SUBMITTED: Execute swap
            state = transitionState(state, OrderState.SUBMITTED);
            logger.info({ jobId: job.id, orderId, state }, 'worker: executing swap');
            wsManager.emit(orderId, { orderId, state, message: 'Transaction submitted to blockchain...' });

            const swapResult = await dexRouter.executeSwap(selectedQuote, order);

            // CONFIRMED: Transaction successful
            state = transitionState(state, OrderState.CONFIRMED);
            logger.info({ 
                jobId: job.id, 
                orderId, 
                state, 
                txHash: swapResult.txHash,
                dex: swapResult.dexUsed,
                executedPrice: swapResult.executedPrice
            }, 'worker: swap confirmed');
            
            wsManager.emit(orderId, { 
                orderId, 
                state, 
                txHash: swapResult.txHash,
                dexUsed: swapResult.dexUsed,
                inputAmount: swapResult.inputAmount,
                outputAmount: swapResult.outputAmount.toFixed(2),
                executedPrice: swapResult.executedPrice.toFixed(2),
                fee: (swapResult.fee * 100).toFixed(2) + '%'
            });

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