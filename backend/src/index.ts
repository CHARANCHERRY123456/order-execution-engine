import { buildApp } from "./app.js";
import { env } from "./config/env.js";

async function startServer() {

    const app = buildApp();
    try{
        await app.listen({ port: env.PORT, host: '0.0.0.0' });
        app.log.info(`Server is running at port : ${env.PORT}`);
    }catch(err){
        app.log.error(err);
        process.exit(1);
    }
}

startServer();