import Redis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

const redis = new Redis({
    host: "redis-17725.c301.ap-south-1-1.ec2.redns.redis-cloud.com",
    port: 17725,
    username: 'default',
    password: 'iFFzDwfmPX9hdEs5MhGVbofXb5jAnlot',
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