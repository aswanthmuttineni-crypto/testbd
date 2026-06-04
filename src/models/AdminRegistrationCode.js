import mongoose from "mongoose";

const adminRegistrationCodeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, index: true },
    phone: { type: String, default: "" },
    passwordHash: { type: String, required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    attempts: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export default mongoose.model("AdminRegistrationCode", adminRegistrationCodeSchema);
