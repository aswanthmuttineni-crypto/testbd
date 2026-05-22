import mongoose from "mongoose";

const weeklyMenuSchema = new mongoose.Schema(
  {
    day: { type: String, required: true },
    breakfast: { type: String, default: "" },
    lunch: { type: String, default: "" },
    dinner: { type: String, default: "" }
  },
  { _id: false }
);

const settingSchema = new mongoose.Schema(
  {
    hostelName: { type: String, default: "Hostel Management System" },
    adminEmail: { type: String, default: "admin@gmail.com" },
    address: { type: String, default: "" },
    foodMenu: {
      type: String,
      default: "Breakfast: Idli, sambar\nLunch: Rice, dal, vegetables\nDinner: Chapati, curry"
    },
    weeklyMenu: {
      type: [weeklyMenuSchema],
      default: [
        { day: "Monday", breakfast: "Idli, sambar", lunch: "Rice, dal, vegetables", dinner: "Chapati, curry" },
        { day: "Tuesday", breakfast: "Upma", lunch: "Rice, sambar, fry", dinner: "Rice, dal, curd" },
        { day: "Wednesday", breakfast: "Dosa", lunch: "Vegetable rice", dinner: "Chapati, paneer curry" },
        { day: "Thursday", breakfast: "Poori", lunch: "Rice, rasam, vegetables", dinner: "Rice, egg curry" },
        { day: "Friday", breakfast: "Pongal", lunch: "Rice, dal, fry", dinner: "Chapati, mixed curry" },
        { day: "Saturday", breakfast: "Vada, chutney", lunch: "Lemon rice, curd", dinner: "Rice, chicken curry" },
        { day: "Sunday", breakfast: "Dosa", lunch: "Special meals", dinner: "Rice, dal, vegetables" }
      ]
    },
    notificationEmail: { type: String, default: "" },
    emailNotificationsEnabled: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model("Setting", settingSchema);
