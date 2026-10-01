import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getProblemStats, getSubmissionStats } from "../controllers/stats.controller.js";

const router = new Router();


router.route("/submissions/getAll/:problemId").get(verifyJWT,getProblemStats);
router.route("/submissions/getOne/:submissionId").get(verifyJWT,getSubmissionStats);

export default router;