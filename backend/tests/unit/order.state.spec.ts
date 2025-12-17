import { describe , it , expect } from "vitest";
import { OrderState } from "../../src/modules/orders/domain/order.state";
import { transitionState } from "../../src/modules/orders/domain/order.state-machine";

describe("Order State Machine" , ()=>{
    it("allows valid transition" , ()=>{
        const next = transitionState(OrderState.PENDING , OrderState.ROUTING);
        expect(next).toBe(OrderState.ROUTING);
    })

    it("Blocks invalid transition" , ()=>{
        expect(
            ()=> transitionState(OrderState.PENDING , OrderState.CONFIRMED)
        ).toThrow();
    })
})