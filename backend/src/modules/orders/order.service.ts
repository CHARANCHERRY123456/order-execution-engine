import { v4 as uuidv4 } from "uuid";
import { orderQueue } from "./queue/order.queue";

export class OrderService {
  async executeOrder(){
    const orderId = uuidv4();

    await orderQueue.add(
      "execute-order",
      { orderId },
      {
        attempts : 3,
        backoff : {
          type : "exponential",
          delay : 1000
        }
      }
    )

    return {orderId};
  };

   
}
