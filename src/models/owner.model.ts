import mongoose from "mongoose";
import { type IOwner } from "../interfaces/owner.inteface.js";

const ownerSchema = new mongoose.Schema<IOwner>({
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
  isApproved: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}).index({ phone: 1 });

const OwnerModel = mongoose.model("Owner", ownerSchema);

export default OwnerModel;
