import fastify from 'fastify';
import loggerOptions from './config/logger.js';

export function buildApp() {
    // enable ignoreTrailingSlash so routes match with or without trailing slash
    const app = fastify({ logger: loggerOptions, ignoreTrailingSlash: true });

    // keep it extremely simple: store start time with Date.now()
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

    app.get('/health', async () => ({ status: 'ok' }));

    return app;
}