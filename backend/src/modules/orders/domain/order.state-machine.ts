import { OrderState } from "./order.state";
import { ORDER_STATE_TRANSITIONS } from "./order.transactions";
export function transitionState(
  current: OrderState,
  next: OrderState
): OrderState {
  const allowed = ORDER_STATE_TRANSITIONS[current];

  if (!allowed.includes(next)) {
    throw new Error(
      `Invalid state transition: ${current} → ${next}`
    );
  }

  return next;
}
