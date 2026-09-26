import dotenv from 'dotenv'
import dns from 'node:dns/promises'
import connectDB from './db/index.js';

dotenv.config({
    path: './.env'
})

dns.setServers(['1.1.1.1', '8.8.8.8']);

import { app } from './app.js';

connectDB().then(() => {
    app.on("error" , (error) => {
            console.log("ERROR: ",error);
            throw error;
        })

    app.listen(process.env.PORT || 8000, ()=>{
        console.log(`Server is running at port: ${process.env.PORT}`)
    })
})
.catch((error) => {
    console.log("MONGO db connection failed !", error)
})
