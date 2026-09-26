import { Router } from "express";
import {  googleLogin, getCurrentUser, loginUser, logoutUser, refreshAccessToken, registerUser, updateAccountDetails, } from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = new Router();

router.route("/register").post(registerUser)
router.route("/login").post(loginUser) 
router.route("/google").get(googleLogin)
//secured routes

router.route("/logout").post(verifyJWT , logoutUser)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/current-user").post(verifyJWT , getCurrentUser)
router.route("/update-account").patch(verifyJWT , updateAccountDetails)

 

export default router;