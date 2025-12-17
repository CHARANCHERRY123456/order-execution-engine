import { OrderState } from "./order.state";

export const ORDER_STATE_TRANSITIONS: Record<
  OrderState,
  OrderState[]
> = {
  [OrderState.PENDING]: [OrderState.ROUTING],
  [OrderState.ROUTING]: [OrderState.BUILDING, OrderState.FAILED],
  [OrderState.BUILDING]: [OrderState.SUBMITTED, OrderState.FAILED],
  [OrderState.SUBMITTED]: [OrderState.CONFIRMED, OrderState.FAILED],
  [OrderState.CONFIRMED]: [],
  [OrderState.FAILED]: [],
};
