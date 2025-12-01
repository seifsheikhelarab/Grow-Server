import mongoose from "mongoose";
import { type IGoal } from "../interfaces/goal.inteface.js";

const goalSchema = new mongoose.Schema<IGoal>({
    userType: {
        type: String,
        enum: ["Customer", "Worker", "Owner"],
        required: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "userType",
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    targetAmount: {
        type: Number,
        required: true,
    },
    currentAmount: {
        type: Number,
        default: 0,
    },
    status: {
        type: String,
        enum: ["Active", "Completed"],
        default: "Active",
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
})

goalSchema.index({ userType: 1, user: 1 }, { unique: true })

const GoalModel = mongoose.model("Goal", goalSchema)

export default GoalModel