import { FastifyInstance } from "fastify";
import { wsManager } from "../../shared/websocket/ws.manager";



export async function orderWebSocket(app:FastifyInstance) {
    app.get(
        "/ws/orders/:orderId",
        {websocket : true},
        (connection , request) => {
            const {orderId} = request.params as {orderId : string}

            wsManager.add(orderId , connection.socket);

            connection.socket.on("close" , ()=>{
                wsManager.remove(orderId , connection.socket);
            })
        }
    )
}