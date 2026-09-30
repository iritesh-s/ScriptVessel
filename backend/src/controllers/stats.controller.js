import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { getSubmissions } from "../db/operations.js";

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



export {
    getProblemStats
}