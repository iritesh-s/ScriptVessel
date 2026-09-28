import { Router } from "express";
import { execPyCode, getJobStatus } from "../controllers/execute.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = new Router();


router.route("/executeCode").post(verifyJWT,execPyCode);
router.route("/checkJob/:jobId").get(verifyJWT,getJobStatus);

export default router;