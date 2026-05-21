import mongoose from "mongoose";

const settingSchema = new mongoose.Schema(
  {
    hostelName: { type: String, default: "Hostel Management System" },
    adminEmail: { type: String, default: "admin@gmail.com" },
    address: { type: String, default: "" },
    foodMenu: {
      type: String,
      default: "Breakfast: Idli, sambar\nLunch: Rice, dal, vegetables\nDinner: Chapati, curry"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Setting", settingSchema);
