import {Worker} from 'bullmq';
import {connection} from '../queues/codeQueue.js'
import { v4 as uuidv4 } from 'uuid';
import { scriptGenerator } from '../utils/scripts/scriptGenerator.js';
import {  spawn } from 'node:child_process';
import fs from 'fs';
import path from 'path';
import { saveSubmission } from '../db/operations.js';
import { calculateVerdict } from '../utils/validation/calculateVerdict.js';

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
    "executions",
    async (Job) => {
        console.log("Processing code execution job...", Job.id, Job.name, Job.data);

        // 1. Destructure all required fields from Job.data
        const { userId, problemId, language, code, testCases } = Job.data;
        console.log('PROBLEM: ', problemId)
        console.log('USER: ', userId)
        const uid = uuidv4();
        const userFolderPath = path.join(process.cwd(), "public", "temp", uid);
        await fs.promises.mkdir(userFolderPath, { recursive: true });

        const codeFilePath = path.join(userFolderPath, `userCode.${Mapping[language]}`);
        const testCaseFilePath = path.join(userFolderPath, `testCases.json`);
        const runnerFilePath = path.join(userFolderPath, `runner.${Mapping[language]}`);
        const runnerPath = path.join(process.cwd(), "scripts", `${language}.${Mapping[language]}`);

        try {
            await fs.promises.writeFile(codeFilePath, code);
            await fs.promises.writeFile(testCaseFilePath, JSON.stringify(testCases, null, 2));
            const templateData = await fs.promises.readFile(runnerPath, 'utf8');
            await fs.promises.writeFile(runnerFilePath, templateData, 'utf8');
        } catch (err) {
            await fs.promises.rm(userFolderPath, { recursive: true, force: true }).catch(() => {});
            throw new Error(`File setup failed: ${err.message}`);
        }

        // 2. Pre-declare variables in the function scope
        let output = "";
        let errorOutput = "";
        let parsedResults = [];
        let metrics = { runtimeMs: 0, memoryMb: 0 };
        let verdict = null;

        try {
            const args = scriptGenerator(language, userFolderPath);
            const { stdout, stderr } = await executeScript('docker', args);

            output = stdout;
            errorOutput = stderr;
            console.log("--- DOCKER SUCCESS STDOUT ---", output);

            const resultFilePath = path.join(userFolderPath, `result.json`);
            const data = await fs.promises.readFile(resultFilePath, 'utf-8');
            const resultData = JSON.parse(data);

            parsedResults = resultData.results || resultData.result || [];
            metrics = resultData.metrics || { runtimeMs: 0, memoryMb: 0 };

            verdict = calculateVerdict({
                docker: { output, errorOutput },
                results: parsedResults,
                metrics
            });

        } catch (error) {
            output = error.stdout || '';
            errorOutput = error.stderr || error.message;
            console.log("--- DOCKER CRASHED ---");
            console.log("STDERR:", errorOutput);

            verdict = {
                status: errorOutput.includes("Time Limit Exceeded")
                    ? "Time Limit Exceeded"
                    : errorOutput.includes("Output Limit Exceeded")
                    ? "Output Limit Exceeded"
                    : "Runtime Error",
                details: errorOutput
            };
        } finally {
            // Clean up temporary workspace directory
            try {
                await fs.promises.rm(userFolderPath, { recursive: true, force: true });
            } catch (unlinkErr) {
                console.error("Critical: Failed to delete temp directory:", userFolderPath);
            }
        }

        // 3. Persist to PostgreSQL regardless of success or failure
        let savedRow = null;
        try {
            savedRow = await saveSubmission({
                userId: userId || 'anonymous',
                problemId: problemId || 'unknown',
                code,
                language,
                verdict: verdict.status,
                runtimeMs: metrics.runtimeMs,
                memoryMb: metrics.memoryMb
            });
        } catch (dbErr) {
            console.error("Failed to persist submission to database:", dbErr);
        }

        console.log("Execution job completed!", Job.id);

        // 4. Return single consolidated payload to BullMQ
        return {
            docker: { output, errorOutput },
            verdict,
            results: parsedResults,
            metrics,
            submissionId: savedRow?.id
        };
    },
    {
        connection,
        concurrency: 5
    }
);

worker.on("completed", (job) => {
    console.log("Job completed!", job.id, job.name);
});

worker.on("failed", (job, err) => {
    console.log("Job failed!", job.id, job.name, err);
});