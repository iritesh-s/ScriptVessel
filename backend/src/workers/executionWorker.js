import {Worker} from 'bullmq';
import {connection} from '../queues/codeQueue.js'
import { v4 as uuidv4 } from 'uuid';
import { scriptGenerator } from '../utils/scripts/scriptGenerator.js';
import { exec } from 'node:child_process';
import util from 'node:util';
import fs from 'fs';
import path from 'path';


const execPromise = util.promisify(exec);

const Mapping = {
    'python': 'py',
    'javascript': 'js',
    'java': 'java',
    'c++': 'cpp',
    'c': 'c'
};

const worker = new Worker(
    "executions",async (Job)=>{
        console.log("Processing code execution job...", Job.id , Job.name, Job.data);

        const { language, code } = Job.data;

        const uid = uuidv4();
        
        const userFolderPath = path.join(process.cwd(), "public", "temp");
        const filePath = path.join(userFolderPath, `${uid}.${Mapping[language]}`);

        fs.mkdirSync(userFolderPath, { recursive: true });
        
        try {
           await fs.promises.writeFile(filePath, code);
        } catch (err) {
            throw new Error(`Server failed to store your code locally: ${err.message}`);
        }

        let output = "";
        let errorOutput = "";

        try {
            
            const script = scriptGenerator(language, uid, userFolderPath);
            
            const { stdout, stderr } = await execPromise(script);
            output = stdout;
            errorOutput = stderr;

        } catch (error) {
            output = error.stdout;
            errorOutput = error.stderr || error.message;
        } finally {
            try {
                await fs.promises.unlink(filePath);
            } catch (unlinkErr) {
                console.error("Critical: Failed to delete temp file:", filePath);
            }
        }

        console.log("Execution job completed!", Job.id , Job.name , Job.data);
        
        return {output , errorOutput};
    },
    {
        connection,
        concurrency: 5
    }
    
);

worker.on("completed" , (job) => {
    console.log("Job completed!" , job.id , job.name , job.data);
})

worker.on("failed" , (job, err) => {
    console.log("Job failed!" , job.id , job.name , job.data , err);
})