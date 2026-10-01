import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { calculateSubmissionMetrics, getProblemDistributions, getSubmissionById, getSubmissions} from "../db/operations.js";

const getProblemStats = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const {problemId} = req.params;

    console.log('PROBLEM: ', problemId)
    console.log('USER: ', userId)

    let submissions = {};
    try {
        submissions = await getSubmissions({
            userId: userId.toString(),
            problemId
        })
        console.log(submissions);
    } catch (error) {
        throw new ApiError(`Cannot fetch the submissions from the Database: ${error.message}`);
    }

    return res.status(200).json(
        new ApiResponse(200, submissions, "Submissions fetched successfully!")
    );
});

const getSubmissionStats = asyncHandler(async(req,res)=> {
    const userId = req.user._id.toString();
    const {submissionId} = req.params;

    const submission = await getSubmissionById(submissionId,userId);
    if(!submission){
        throw new ApiError(500,`Failed to fetch the submission with id: ${submissionId} from database.`)
    }
    const {problem_id, verdict , runtime_ms , memory_mb,language} = submission;
    const stats = await calculateSubmissionMetrics(problem_id,verdict,runtime_ms,memory_mb);
    if(!stats){
        throw new ApiError(500,`Failed to fetch the stats for submission with id: ${submissionId} from database.`)
    }

    const buckets = await getProblemDistributions(problem_id,language);
    return res.status(200).json(
        new ApiResponse(200, {stats,submission,buckets},'The submission was fetched successfully!')
    );
})

export {
    getProblemStats,
    getSubmissionStats
}