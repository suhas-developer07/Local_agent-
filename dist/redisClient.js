"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const redis = new ioredis_1.default({
    host: "redis-17725.c301.ap-south-1-1.ec2.redns.redis-cloud.com",
    port: 17725,
    username: 'default',
    password: 'iFFzDwfmPX9hdEs5MhGVbofXb5jAnlot',
    tls: undefined // Explicitly disable TLS
});
redis.on("connect", () => {
    console.log("connected to Redis Cloude");
});
redis.on("error", (err) => {
    console.error("Redis error", err);
});
exports.default = redis;
