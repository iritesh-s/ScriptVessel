import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { addToQueue, executionQueue } from "../queues/codeQueue.js"
import { calculateVerdict } from "../utils/validation/calculateVerdict.js";

const Mapping = {
    'python': 'py',
    'javascript' : 'js',
    'java' : 'java',
    'c++': 'cpp',
    'c' : 'c'
}

const execPyCode = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const {problemId} = req.params;
    const { language, code, testCases } = req.body;
    
    if (!Object.keys(Mapping).includes(language)) {
        throw new ApiError(409, 'Unsupported language selected!');
    }
    if (!code || code.trim() === "") {
        throw new ApiError(409, 'Empty code block!');
    }

    const job = await addToQueue(language , code, testCases, problemId, userId)

    return res.status(200).json(
        new ApiResponse(202, job.id, "Job added to queue")
    );
});


const getJobStatus = asyncHandler(async (req, res) => {
    const { jobId } = req.params;

    const checkJob = await executionQueue.getJob(jobId);

    if (!checkJob) {
        return res.status(404).json(
            new ApiResponse(404, null, 'There is no such job in the queue!')
        );
    }

    const state = await checkJob.getState();

    if (state === 'failed') {
        return res.status(500).json(
            new ApiResponse(
                500,
                { 
                    success: false, 
                    state: "failed", 
                    error: checkJob.failedReason || "Worker execution failed" 
                },
                "Job failed execution"
            )
        );
    }

    if (state !== 'completed') {
        return res.status(202).json(
            new ApiResponse(
                202,
                { success: true, state },
                `The job is currently ${state}`
            )
        );
    }

    const returnVal = checkJob.returnvalue || {};
    return res.status(200).json(
        new ApiResponse(
            200,
            {
                success: true,
                state: "completed",
                verdict: returnVal.verdict || { status: "Unknown" },
                metrics: returnVal.metrics || { runtimeMs: 0, memoryMb: 0 },
                results: returnVal.results || returnVal.result || [],
                submissionId: returnVal.submissionId || null
            },
            "Job is completed!"
        )
    );
});

export {
    execPyCode,
    getJobStatus
}