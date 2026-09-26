import { Router } from "express";
import { execPyCode } from "../controllers/test.controller.js";

const router = new Router();


router.route("/executeCode").post(execPyCode);

export default router;