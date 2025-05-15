import Redis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT) ,
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    tls: undefined // Explicitly disable TLS
  });
redis.on("connect", ()=>{
    console.log("connected to Redis Cloude")
});
redis.on("error", (err)=>{
    console.error("Redis error", err);
}
);

export default redis;   