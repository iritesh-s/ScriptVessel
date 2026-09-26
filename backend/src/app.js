import 'dotenv/config'
import cookieParser from "cookie-parser";
import cors from "cors";
import express from 'express';

const app = express();
const allowedOrigins = process.env.CORS_ORIGIN.split(',')


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

//adding them to app
app.use('/remoteSandbox/v1/test', testRouter);
app.use('/remoteSandbox/v1/auth',authRouter);

export {
  app
}