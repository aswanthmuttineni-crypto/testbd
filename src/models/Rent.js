import mongoose from "mongoose";

const rentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true },
    month: { type: String, required: true },
    year: { type: Number, required: true },
    amount: { type: Number, required: true },
    paymentDate: { type: Date, default: null },
    status: { type: String, enum: ["PAID", "PENDING"], default: "PAID" },
    note: { type: String, default: "" }
  },
  { timestamps: true }
);

export default mongoose.model("Rent", rentSchema);
