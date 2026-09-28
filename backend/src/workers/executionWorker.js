import {Worker} from 'bullmq';
import {connection} from '../queues/codeQueue.js'
import { v4 as uuidv4 } from 'uuid';
import { scriptGenerator } from '../utils/scripts/scriptGenerator.js';
import {  spawn } from 'node:child_process';
import fs from 'fs';
import path from 'path';

const MAX_EXECUTION_TIME_MS = 12000; // 5 seconds
const MAX_OUTPUT_SIZE_BYTES = 1024 * 50; // 50 KB

const executeScript = (command, args , input="") => {
    return new Promise((resolve, reject) => {
        
        const child = spawn(command, args);

        let stdout = '';
        let stderr = '';
        let outputSize = 0;

        if (input) {
            child.stdin.write(input);
        }
        // CRITICAL: You MUST call .end(). This sends the EOF (End of File) signal.
        // If you don't call this, Python's input() will hang forever waiting for more text, 
        // and your container will trigger the Time Limit Exceeded (TLE) error.
        child.stdin.end()


        child.stdout.on('data', (data) => {
            outputSize += data.length;
            if (outputSize > MAX_OUTPUT_SIZE_BYTES) {
                child.kill('SIGKILL'); // Forcefully kill the process
                reject({ stdout, stderr: 'Error: Output Limit Exceeded (OLE)' });
                return;
            }
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        const timeout = setTimeout(() => {
            child.kill('SIGKILL');
            reject({ stdout, stderr: 'Error: Time Limit Exceeded (TLE)' });
        }, MAX_EXECUTION_TIME_MS)


        child.on('error', (error) => {
            clearTimeout(timeout);
            reject({ stdout, stderr: error.message });
        });

        child.on('close', (code) => {
            clearTimeout(timeout);
            if (code === 0) {
                resolve({ stdout, stderr });
            } else if (code === null) {
                 // The process was killed by a signal (like our OLE or TLE logic)
                 // Do nothing, as the reject logic is handled above.
            } else {
                reject({ stdout, stderr: stderr || `Process exited with code ${code}` });
            }
        });
    });
};


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

        const { language, code, input } = Job.data;

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
            
            const args = scriptGenerator(language, uid, userFolderPath);
            
            const { stdout, stderr } = await executeScript('docker',args, input);
            output = stdout;
            errorOutput = stderr;

        } catch (error) {
            output = error.stdout || '';
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