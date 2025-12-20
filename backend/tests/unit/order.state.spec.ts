import { describe , it , expect } from "vitest";
import { OrderState } from "../../src/modules/orders/domain/order.state";
import { transitionState } from "../../src/modules/orders/domain/order.state-machine";
import { ORDER_STATE_TRANSITIONS } from "../../src/modules/orders/domain/order.transactions";

describe("Order State Machine" , ()=>{
    describe("Valid Transitions", () => {
        it("allows PENDING → ROUTING" , ()=>{
            const next = transitionState(OrderState.PENDING , OrderState.ROUTING);
            expect(next).toBe(OrderState.ROUTING);
        })

        it("allows ROUTING → BUILDING", () => {
            const next = transitionState(OrderState.ROUTING, OrderState.BUILDING);
            expect(next).toBe(OrderState.BUILDING);
        })

        it("allows ROUTING → FAILED", () => {
            const next = transitionState(OrderState.ROUTING, OrderState.FAILED);
            expect(next).toBe(OrderState.FAILED);
        })

        it("allows BUILDING → SUBMITTED", () => {
            const next = transitionState(OrderState.BUILDING, OrderState.SUBMITTED);
            expect(next).toBe(OrderState.SUBMITTED);
        })

        it("allows BUILDING → FAILED", () => {
            const next = transitionState(OrderState.BUILDING, OrderState.FAILED);
            expect(next).toBe(OrderState.FAILED);
        })

        it("allows SUBMITTED → CONFIRMED", () => {
            const next = transitionState(OrderState.SUBMITTED, OrderState.CONFIRMED);
            expect(next).toBe(OrderState.CONFIRMED);
        })

        it("allows SUBMITTED → FAILED", () => {
            const next = transitionState(OrderState.SUBMITTED, OrderState.FAILED);
            expect(next).toBe(OrderState.FAILED);
        })
    })

    describe("Invalid Transitions", () => {
        it("blocks PENDING → CONFIRMED (skipping states)" , ()=>{
            expect(
                ()=> transitionState(OrderState.PENDING , OrderState.CONFIRMED)
            ).toThrow(/Invalid state transition/);
        })

        it("blocks PENDING → BUILDING (skipping ROUTING)", () => {
            expect(
                () => transitionState(OrderState.PENDING, OrderState.BUILDING)
            ).toThrow(/Invalid state transition/);
        })

        it("blocks CONFIRMED → any state (terminal state)", () => {
            expect(
                () => transitionState(OrderState.CONFIRMED, OrderState.PENDING)
            ).toThrow(/Invalid state transition/);
        })

        it("blocks FAILED → any state (terminal state)", () => {
            expect(
                () => transitionState(OrderState.FAILED, OrderState.PENDING)
            ).toThrow(/Invalid state transition/);
        })

        it("blocks backward transitions", () => {
            expect(
                () => transitionState(OrderState.BUILDING, OrderState.ROUTING)
            ).toThrow(/Invalid state transition/);
        })
    })

    describe("State Transition Map", () => {
        it("defines all states in the transition map", () => {
            const allStates = Object.values(OrderState);
            allStates.forEach(state => {
                expect(ORDER_STATE_TRANSITIONS).toHaveProperty(state);
            });
        })

        it("terminal states have no valid transitions", () => {
            expect(ORDER_STATE_TRANSITIONS[OrderState.CONFIRMED]).toEqual([]);
            expect(ORDER_STATE_TRANSITIONS[OrderState.FAILED]).toEqual([]);
        })
    })
})