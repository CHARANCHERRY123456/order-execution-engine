import { v4 as uuidv4 } from "uuid";
import { OrderState } from "./domain/order.state";
import { transitionState } from "./domain/order.state-machine";
import { wsManager } from "../../shared/websocket/ws.manager";

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export class OrderService {
  async executeOrder() {
    const orderId = uuidv4();
    let state = OrderState.PENDING;

    wsManager.emit(orderId,JSON.stringify({ orderId, state }));

    await sleep(1000);
    state = transitionState(state, OrderState.ROUTING);
    wsManager.emit(orderId, JSON.stringify({ orderId, state }));
    await sleep(1000);
    state = transitionState(state, OrderState.BUILDING);
    wsManager.emit(orderId, JSON.stringify({ orderId, state }));

    await sleep(1000);
    state = transitionState(state, OrderState.SUBMITTED);
    wsManager.emit(orderId, JSON.stringify({ orderId, state }));
    await sleep(1000);
    state = transitionState(state, OrderState.CONFIRMED);
    wsManager.emit(orderId, JSON.stringify({ orderId, state }));

    return { orderId };
  }
}
