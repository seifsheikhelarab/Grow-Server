import mongoose from "mongoose";
import { type ITransaction } from "../interfaces/transaction.inteface.js";

const transactionSchema = new mongoose.Schema<ITransaction>({
  senderType: {
    type: String,
    enum: ["Worker", "Owner"],
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "senderType",
    required: true,
  },
  kiosk: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Kiosk",
    required: true,
  },
  customerPhone: {
    type: String,
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

const TransactionModel = mongoose.model("Transaction", transactionSchema)

export default TransactionModel
