import mongoose, { Schema, model } from "mongoose";
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

const userSchema = Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    fullName: { type: String, required: true, trim: true, index: true },

    password: { type: String,},

    refreshToken: { type: String},
  },
  { timestamps: true }
);

// userSchema.pre("save" , async function (next){
//     if(!this.isModified("password")) return next();//encrypt the password only once and not at every query 

//     this.password = bcrypt.hash(this.password, 10);
//     next();
// }); 
// Remove 'next' from the arguments
userSchema.pre("save", async function () {
    // If not modified, just return (no next() needed)
    if (!this.isModified("password")) return;

    // Use 'await' to ensure hashing finishes
    this.password = await bcrypt.hash(this.password, 10);
    
    // No next() call needed here
});//next() is  not needed because we have used the async await 

userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password, this.password)
}

userSchema.methods.generateAccessToken = function(){
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullName: this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}
userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            _id: this._id,
            
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const User = model("User", userSchema); 