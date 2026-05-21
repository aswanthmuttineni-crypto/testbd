import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    category: {
      type: String,
      enum: ["Electricity", "Water", "Maintenance", "Food", "Salary", "Internet", "Repairs"],
      required: true
    },
    date: { type: Date, required: true },
    notes: String,
    bill: {
      filename: String,
      path: String,
      mimetype: String
    }
  },
  { timestamps: true }
);

export default mongoose.model("Expense", expenseSchema);
