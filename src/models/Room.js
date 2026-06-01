import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    roomNo: { type: String, required: true, unique: true },
    floor: { type: Number, required: true },
    capacity: { type: Number, required: true, min: 1 },
    rentAmount: { type: Number, required: true, min: 0 },
      status: { type: String, enum: ["OCCUPIED", "VACANT"], default: "VACANT" },
      // Amenities (fixed boolean flags)
      ac: { type: Boolean, default: false },
      tv: { type: Boolean, default: false },
      fridge: { type: Boolean, default: false },
      fan: { type: Boolean, default: false },
      heater: { type: Boolean, default: false },
      wifi: { type: Boolean, default: false },
      wardrobe: { type: Boolean, default: false },
      attachedBath: { type: Boolean, default: false }
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
