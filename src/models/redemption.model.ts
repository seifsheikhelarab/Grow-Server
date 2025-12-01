import mongoose from "mongoose";
import { type IRedemption } from "../interfaces/redemption.inteface.js";

const redemptionSchema = new mongoose.Schema<IRedemption>({
    requesterType: {
        type: String,
        enum: ["Customer", "Worker", "Owner"],
        required: true,
    },
    requester: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "requesterType",
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending",
    },
    fee: {
        type: Number,
        default: 5,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
})

redemptionSchema.index({ requesterType: 1, requester: 1 }, { unique: true })
  
const RedemptionModel = mongoose.model("Redemption", redemptionSchema)

export default RedemptionModel