import { Router } from "express";
import { execPyCode, getJobStatus } from "../controllers/test.controller.js";

const router = new Router();


router.route("/executeCode").post(execPyCode);
router.route("/checkJob/:jobId").get(getJobStatus);

export default router;