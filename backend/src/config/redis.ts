import IOredis from "ioredis";
import env from "./env";

export const redis = new IOredis(
    env.REDIS_URL || "redis://localhost:6379",{
        maxRetriesPerRequest: null,
    }
)

// redis-cli --tls -u redis://default:AXD6AAIncDFkNjhiYTViZDE4OTc0OTdiYTViM2ZlODQwNDRlMzkzMHAxMjg5MjI@ruling-gobbler-28922.upstash.io:6379