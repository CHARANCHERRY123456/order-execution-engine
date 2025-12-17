import { FastifyRequest , FastifyReply } from "fastify";
import { OrderService } from "./order.service";

const service = new OrderService();

export async function executeOrderHandler(
    _req:FastifyRequest,
    reply : FastifyReply
    ) {
    const result = await service.executeOrder();
    reply.send(result);
}