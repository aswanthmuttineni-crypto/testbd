import mongoose from "mongoose";

const tenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    bedNo: { type: Number, required: true },
    joiningDate: { type: Date, required: true },
    advanceAmount: { type: Number, default: 0 },
    monthlyRent: { type: Number, required: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    idProof: {
      filename: String,
      path: String,
      mimetype: String
    }
  },
  { timestamps: true }
);

tenantSchema.index({ roomId: 1, bedNo: 1, status: 1 });

export default mongoose.model("Tenant", tenantSchema);
