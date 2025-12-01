import mongoose from "mongoose";
import { type IKiosk } from "../interfaces/kiosk.inteface.js";

const kioskSchema = new mongoose.Schema<IKiosk>({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Owner",
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  dues: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}).index({ owner: 1 });

const KioskModel = mongoose.model("Kiosk", kioskSchema);

export default KioskModel;