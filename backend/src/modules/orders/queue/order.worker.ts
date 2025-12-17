import { Worker } from "bullmq";
import { redis } from "../../../config/redis";
import { OrderState } from "../domain/order.state";
import { transitionState } from "../domain/order.state-machine";
import { wsManager } from "../../../shared/websocket/ws.manager";

function sleep(ms : number){
    return new Promise((res)=>setTimeout(res, ms));
}

export const orderWorker = new Worker(
    "order-queue",
    async (job) => {
        const {orderId} = job.data;
        let state = OrderState.PENDING;
        wsManager.emit(orderId , {orderId, state});

        await sleep(2000);
        state = transitionState(state , OrderState.BUILDING);
        wsManager.emit(orderId , {orderId, state});
    
        await sleep(1000);
        state = transitionState(state , OrderState.SUBMITTED);
        wsManager.emit(orderId , {orderId, state});
        await sleep(1000);
        state = transitionState(state , OrderState.CONFIRMED);
        wsManager.emit(orderId , {orderId, state});

        return { orderId, finalState: state };
    }, {
        connection : redis,
        concurrency : 10,
    }
)