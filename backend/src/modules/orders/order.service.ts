import { v4 as uuidv4 } from "uuid";
import { orderQueue } from "./queue/order.queue";
import { OrderInput } from "./dex/dex.types";

export class OrderService {
  async executeOrder(orderData: OrderInput){
    const orderId = uuidv4();

    await orderQueue.add(
      "execute-order",
      { orderId, orderData },
      {
        attempts : 3,
        backoff : {
          type : "exponential",
          delay : 1000
        }
      }
    )

    return { orderId, order: orderData };
  };

   
}
