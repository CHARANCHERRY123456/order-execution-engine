import { FastifyRequest , FastifyReply } from "fastify";
import { OrderService } from "./order.service";
import { OrderInput } from "./dex/dex.types";

const service = new OrderService();

interface OrderRequestBody {
    tokenIn: string;
    tokenOut: string;
    amount: number;
    slippage?: number;
}

export async function executeOrderHandler(
    req: FastifyRequest<{ Body: OrderRequestBody }>,
    reply: FastifyReply
) {
    // Validate input
    const { tokenIn, tokenOut, amount, slippage } = req.body || {};
    
    if (!tokenIn || !tokenOut || amount === undefined || amount === null) {
        return reply.status(400).send({
            error: 'Missing required fields',
            required: ['tokenIn', 'tokenOut', 'amount']
        });
    }

    if (amount <= 0) {
        return reply.status(400).send({
            error: 'Amount must be greater than 0'
        });
    }

    const orderData: OrderInput = {
        tokenIn,
        tokenOut,
        amount,
        slippage: slippage || 0.01  // Default 1% slippage
    };

    const result = await service.executeOrder(orderData);
    reply.send(result);
}