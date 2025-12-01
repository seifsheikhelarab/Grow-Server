import mongoose from "mongoose";
import { type IWorker } from "../interfaces/worker.inteface.js";

const workerSchema = new mongoose.Schema<IWorker>({
  phone: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  kiosk: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Kiosk",
    required: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Owner",
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  pointsEarned: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}).index({ phone: 1 });

const WorkerModel = mongoose.model("Worker", workerSchema);

export default WorkerModel;