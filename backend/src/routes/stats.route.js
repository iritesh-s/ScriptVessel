import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getProblemStats } from "../controllers/stats.controller.js";

const router = new Router();


router.route("/submissions/:problemId").get(verifyJWT,getProblemStats);

export default router;