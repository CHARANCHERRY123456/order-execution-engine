import { Worker } from 'bullmq';
import { redis } from '../../../config/redis';
import { OrderState } from '../domain/order.state';
import { transitionState } from '../domain/order.state-machine';
import { wsManager } from '../../../shared/websocket/ws.manager';
import { logger } from '../../../config/logger';

function sleep(ms : number){
    return new Promise((res)=>setTimeout(res, ms));
}

export const orderWorker = new Worker(
    "order-queue",
    async (job) => {
        const {orderId} = job.data;
        let state = OrderState.PENDING;
        logger.info({ jobId: job.id, orderId, state }, 'worker: job started');
        wsManager.emit(orderId, { orderId, state });

        // ROUTING: Compare DEX prices (will add mock DEX router later)
        await sleep(5000);
        state = transitionState(state, OrderState.ROUTING);
        logger.info({ jobId: job.id, orderId, state }, 'worker: routing to best DEX');
        wsManager.emit(orderId, { orderId, state });

        // BUILDING: Create transaction
        await sleep(1000);
        state = transitionState(state, OrderState.BUILDING);
        logger.info({ jobId: job.id, orderId, state }, 'worker: building transaction');
        wsManager.emit(orderId, { orderId, state });

        // SUBMITTED: Send to blockchain
        await sleep(1000);
        state = transitionState(state, OrderState.SUBMITTED);
        logger.info({ jobId: job.id, orderId, state }, 'worker: submitted to network');
        wsManager.emit(orderId, { orderId, state });

        // CONFIRMED: Transaction successful
        await sleep(1000);
        state = transitionState(state, OrderState.CONFIRMED);
        logger.info({ jobId: job.id, orderId, state, txHash: 'mock_tx_hash' }, 'worker: confirmed');
        wsManager.emit(orderId, { orderId, state, txHash: 'mock_tx_hash_123' });

        return { orderId, finalState: state };
    }, {
        connection : redis,
        concurrency : 10,
    }
)