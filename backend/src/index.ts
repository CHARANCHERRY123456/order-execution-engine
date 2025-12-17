import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import './modules/orders/queue/order.worker.js'


async function startServer() {

    const app = buildApp();
    try{
        await app.listen({ port: env.PORT, host: '0.0.0.0' });
    }catch(err){
        app.log.error(err);
        process.exit(1);
    }
}

startServer();