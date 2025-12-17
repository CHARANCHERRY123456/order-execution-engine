import { FastifyInstance } from "fastify";
import { executeOrderHandler } from "./order.controller";

export async function orderRoutes(app:FastifyInstance) {
    app.post("/api/orders/execute" , executeOrderHandler)
}

