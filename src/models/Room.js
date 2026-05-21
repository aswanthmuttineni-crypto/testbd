import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    roomNo: { type: String, required: true, unique: true },
    floor: { type: Number, required: true },
    capacity: { type: Number, required: true, min: 1 },
    rentAmount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["OCCUPIED", "VACANT"], default: "VACANT" }
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

roomSchema.virtual("occupiedBeds", {
  ref: "Tenant",
  localField: "_id",
  foreignField: "roomId",
  count: true,
  match: { status: "ACTIVE" }
});

export default mongoose.model("Room", roomSchema);
