import fastify from 'fastify';
import loggerOptions from './config/logger.js';
import websocket from "@fastify/websocket";
import { orderRoutes } from './modules/orders/order.routes.js';
import { orderWebSocket } from './modules/orders/order.ws.js';

export function buildApp() {
    const app = fastify({ logger: loggerOptions, ignoreTrailingSlash: true });

    app.addHook('onRequest', (request, reply, done) => {
        (request as any).startTime = Date.now();
        done();
    });

    app.addHook('onResponse', (request, reply, done) => {
        const start = (request as any).startTime || Date.now();
        const duration = Date.now() - start;
        request.log.info({ method: request.method, url: request.url, statusCode: reply.statusCode, duration }, 'request');
        done();
    });

    app.register(websocket);
    app.register(orderRoutes);
    app.register(orderWebSocket);

    app.get('/health', async () => ({ status: 'ok' }));

    return app;
}