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

        const { language, code, testCases } = Job.data;

        const uid = uuidv4();
        
        const userFolderPath = path.join(process.cwd(), "public", "temp", uid);
        await fs.promises.mkdir(userFolderPath, { recursive: true });
        
        const codeFilePath = path.join(userFolderPath, `userCode.${Mapping[language]}`);
        const testCaseFilePath = path.join(userFolderPath, `testCases.json`);
        const runnerFilePath = path.join(userFolderPath, `runner.${Mapping[language]}`);

        
        try {
           await fs.promises.writeFile(codeFilePath, code);
        } catch (err) {
            throw new Error(`Server failed to store your code locally: ${err.message}`);
        }
        try {
            const jsonString = JSON.stringify(testCases, null, 2);

            await fs.promises.writeFile(testCaseFilePath, jsonString);
        } catch (err) {
            throw new Error(`Server failed to store your testCases locally: ${err.message}`);
        }

        const runnerPath = path.join(process.cwd(), "scripts", `${language}.${Mapping[language]}`);
        try {
            const data = await fs.promises.readFile(runnerPath, 'utf8');
            console.log(`Successfully read template file.`);

            await fs.promises.writeFile(runnerFilePath, data, 'utf8');
            console.log(`Created: ${runnerFilePath}`);

        } catch (error) {
            throw new Error(`File processing failed: ${error.message}`);
        }

        let output = "";
        let errorOutput = "";

        try {
            
            const args = scriptGenerator(language, userFolderPath);
            
            const { stdout, stderr } = await executeScript('docker',args);
            
            output = stdout;
            errorOutput = stderr;
            console.log("--- DOCKER SUCCESS STDOUT ---", output);

            const resultFilePath = path.join(userFolderPath, `result.json`);
            const data = await fs.promises.readFile(resultFilePath, 'utf-8');
            const result = JSON.parse(data);
            const metrics = result.metrics;

            console.log("Execution job completed!", Job.id);
            
            // 3. Return the payload
            return { docker: { output, errorOutput }, result: result.results , metrics};

        } catch (error) {
            output = error.stdout || '';
            errorOutput = error.stderr || error.message;
            console.log("--- DOCKER CRASHED ---");
            console.log("STDERR:", errorOutput);
        } finally {
            try {
                await fs.promises.rm(userFolderPath, { recursive: true, force: true });
            } catch (unlinkErr) {
                console.error("Critical: Failed to delete temp file:", userFolderPath);
            }
        }
        if (errorOutput) {
            return { output: "System Error", errorOutput: errorOutput };
        }

    },
    {
        connection,
        concurrency: 5
    }
    
);

worker.on("completed" , (job) => {
    console.log("Job completed!" , job.id , job.name);
})

worker.on("failed" , (job, err) => {
    console.log("Job failed!" , job.id , job.name, err);
})