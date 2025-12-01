import mongoose from "mongoose";
import { type IDue } from "../interfaces/due.inteface.js";

const dueSchema = new mongoose.Schema<IDue>({
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction",
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
})

dueSchema.index({ transaction: 1 }, { unique: true })

const DueModel = mongoose.model("Due", dueSchema)

export default DueModel
