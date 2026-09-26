import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import { oauth2Client } from "../utils/auth/googleConfig.js";
import axios from 'axios';

const generateAccessAndRefreshTokens = async function (userId) {
  try {
    const user = await User.findById(userId);

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating access and refresh tokens!"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  //get user details from frontend
  console.log(req.body);
  const { fullName, email, username, password } = req.body;

  //validation - not empty & valid email
  if (
    [fullName, email, username, password].some((field) => field?.trim() === "") //function of arrays that returns true if any of the element is empty
  ) {
    throw new ApiError(400, "All fields are required!");
  }

  const isValidEmail = (email) => {
  // Checks for valid characters, an @ symbol, a domain name, and a 2+ letter TLD
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
  };

  if (!isValidEmail(email)) {
    throw new ApiError(400, "The email is not valid");
  }

  //check if user already exists: username, email
  const existedUser = await User.findOne({
    //find if the email or username already exists in the database or not ?
    $or: [{ email }, { username }],
  });
  if (existedUser) {
    throw new ApiError(409, "User with this email or username already exists");
  }

  //create user object - create entry in db
  const user = await User.create({
    fullName,
    email,
    password,
    username: username.toLowerCase(),
  });

  //remove password and refresh token field from response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken" //here we write the fields that we dont need
  );

  // ?console.log(createdUser)
  //check for user creation
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  //return response
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully!"));
});

const loginUser = asyncHandler(async (req, res) => {
  //get the data from the user
  const {userRecog, password ,  remember} = req.body;
console.log(req.body);
  //validate the data - not empty
  if (!userRecog) {
    throw new ApiError(400, "Enter either email or username to login!");
  }

  const isEmail = (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  let email, username;
  if(isEmail(userRecog)){
    email = userRecog;
  }else{
    username = userRecog;
  }
  
  //find the user based on either the username or email
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (!user) {
    throw new ApiError(404, "No such user exists!");
  }

  //check if the password enterd is valid or not (remember we defined a method in userSchema for this?)
  if(user.password === undefined){
    throw new ApiError(401, "You registered using Google. Please click 'Sign in with Google'");
  }
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid password!");
  }

  //get the tokens
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );
  //data of the loggedInUser
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  //setting the cookies and returning the response
  const maxAge = remember ? 30 * 24 * 60 * 60 * 1000 : null; // 30 days vs session

  const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      ...(maxAge && { maxAge }) // Only applies maxAge if Remember Me is checked
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully!"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully!"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  try {
    const incommingRefreshToken =
      req.cookies.refreshtoken || req.body.refreshToken;

    if (!incommingRefreshToken) {
      throw new ApiError(401, "Unauthorized request");
    }

    const decodedToken = jwt.verify(
      incommingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "Invalid Refresh Token");
    }

    if (incommingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };

    const { accessToken, newrefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newrefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            newrefreshToken,
          },
          "Access token refreshed successfully!"
        )
      );
  } catch (error) {
    throw new ApiError(401, "Unauthorized request");
  }
});


const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current User fetched!"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body; 

  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName: fullName,
        email: email,
      },
    },
    { new: true } //this will now send the updated information
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Accounts details updated successfully!"));
});

const createUsername = (name, email) => {
  const emailPrefix = email.split('@')[0] || ''
  const seed = emailPrefix || name

  return (
    seed
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24) || `user_${Date.now()}`
  )
}

const googleLogin = asyncHandler(async (req,res) => {
try {
    const {code} = req.query;
    console.log("1. Auth Code received from frontend");
  
    const googleResponse = await oauth2Client.getToken(code);
    console.log("2. Swapped code for Google tokens");
  
    oauth2Client.setCredentials(googleResponse.tokens);
  
    const userRes = await axios.get(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${googleResponse.tokens.access_token}`
    );
    console.log("3. Fetched Google Profile:", userRes.data.email);
  
    const {email, name} = userRes.data;
  
    let user = await User.findOne({email});
  
    if(!user){
      console.log("4. User not found, creating new user...");
      const username = createUsername(name,email);
      user = await User.create({
        fullName: name,email,
        username
      })
      console.log("5. User created successfully");
    }
  
    console.log("6. Generating JWTs...");
    //get the tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user._id
    );
    //setting the cookies and returning the response
    const options = {
      httpOnly: true,
  
      secure: process.env.NODE_ENV === "production", 
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    };
  
    //remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken" //here we write the fields that we dont need
    );
    console.log("7. Success! Sending response.");
    return res
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .status(201)
      .json(new ApiResponse(200, {
            user: createdUser,
            accessToken,
            refreshToken,
          }, "User registered successfully!"));
} catch (error) {
  console.error("🔴 GOOGLE LOGIN CRASHED:");
    console.error(error?.response?.data || error.message || error);
    throw new ApiError(500, "Google login failed");
}

});
export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  getCurrentUser,
  updateAccountDetails,
  googleLogin
};
