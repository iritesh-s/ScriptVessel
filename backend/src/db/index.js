import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";
import pkg from "pg";
const { Pool } = pkg;

export const pgPool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: Number(process.env.PG_PORT) || 5432,
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
    database: process.env.PG_NAME || 'coding_sandbox',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    // Disable SSL for localhost, enable if pointing to remote cloud DB
    ssl: process.env.PG_HOST === 'localhost' || !process.env.PG_HOST ? false : { rejectUnauthorized: false }
});

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        console.log(`\n MongoDB connected !!! DB HOST: ${connectionInstance.connection.host}`);
    } catch (error) {
        console.error("MONGODB connection error:", error.message);
        process.exit(1);
    }

    try {
        const client = await pgPool.connect();
        console.log(`\n SUPABASE connected !!! DB HOST: ${process.env.PG_HOST}`);
        client.release(); 
    } catch (error) {
        console.error("--- SUPABASE ERROR DETAILS ---");
        console.error("Message:", error.message);
        console.error("Code:", error.code);
        console.error("Errno:", error.errno);
        console.error("Syscall:", error.syscall);
        console.error("Full Error Object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        console.error("------------------------------");
        process.exit(1);
    }
};

export default connectDB;