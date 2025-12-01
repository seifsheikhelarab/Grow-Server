import mongoose from "mongoose";
import { type ICommission } from "../interfaces/commission.interface.js";

const commissionSchema = new mongoose.Schema<ICommission>({
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction",
    required: true,
  },
  beneficiaryType: {
    type: String,
    enum: ["Worker", "Owner"],
    required: true,
  },
  beneficiary: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "beneficiaryType",
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

commissionSchema.index({ transaction: 1, beneficiaryType: 1 }, { unique: true })

const CommissionModel = mongoose.model("Commission", commissionSchema)

export default CommissionModel