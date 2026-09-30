import 'dotenv/config'
import cookieParser from "cookie-parser";
import cors from "cors";
import express from 'express';

import Redis from 'ioredis';
import './workers/executionWorker.js'
const app = express();
const allowedOrigins = process.env.CORS_ORIGIN.split(',')

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({extended:true, limit:"16kb"}))
app.use(express.static("public"))
app.use(cookieParser())

//app.use(errorMiddleware);

//importing routers
import testRouter from './routes/test.route.js';
import authRouter from './routes/auth.route.js';
import executeRouter from './routes/execute.route.js'
import statsRouter from './routes/stats.route.js'

//adding them to app
app.use('/remoteSandbox/v1/auth',authRouter);
app.use('/remoteSandbox/v1/test', testRouter);
app.use('/remoteSandbox/v1/execute', executeRouter);
app.use('/remoteSandbox/v1/stats', statsRouter);

export {
  app
}