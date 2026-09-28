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
    const { language, code, testCases } = req.body;
    
    if (!Object.keys(Mapping).includes(language)) {
        throw new ApiError(409, 'Unsupported language selected!');
    }
    if (!code || code.trim() === "") {
        throw new ApiError(409, 'Empty code block!');
    }

    const job = await addToQueue(language , code, testCases)

    return res.status(200).json(
        new ApiResponse(202, job.id, "Job added to queue")
    );
});


const getJobStatus  = asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    
    const checkJob = await executionQueue.getJob(jobId);

    if(!checkJob){
        return res.status(404).json(new ApiResponse(404,checkJob , 'There is no such job in the queue!'))
    }

    
    const state = await checkJob.getState();

    if (state === 'failed') {
        return res.status(500).json(
            new ApiResponse(500, { success: false, state: "failed", message: job.failedReason }, "Job failed execution")
        );
    }
    if (state !== 'completed' && state !== 'failed') {
        return res.status(202).json(
            new ApiResponse(202, { success: true, state }, `The job is currently ${state}`)
        );
    }
    const finalVerdict = calculateVerdict(checkJob.returnvalue);
    
    return res.status(200).json(
        new ApiResponse(200,{
        success: true,
        state: "completed",
        verdict: finalVerdict,           // "Accepted", "Wrong Answer", etc.
        rawMetrics: checkJob.returnvalue.result // Keep the raw array for frontend UI details
    }, "Job is completed!")
    );
});

export {
    execPyCode,
    getJobStatus
}