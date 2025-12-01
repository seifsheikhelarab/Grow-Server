import mongoose from "mongoose";
import { type IUser } from "../interfaces/user.inteface.js";

const userSchema = new mongoose.Schema<IUser>({
  phone: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  points: {
    type: Number,
    default: 0,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}).index({ phone: 1 });

const UserModel = mongoose.model("User", userSchema);

export default UserModel;
