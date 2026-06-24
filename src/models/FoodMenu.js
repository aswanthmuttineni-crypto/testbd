import mongoose from 'mongoose';

const FoodMenuSchema = new mongoose.Schema({
  day: { type: String, required: true },
  breakfast: { type: String },
  lunch: { type: String },
  dinner: { type: String },
  notes: { type: String },
  images: [
    {
      filename: String,
      path: String,
      mimetype: String
    }
  ]
}, { timestamps: true });

export default mongoose.model('FoodMenu', FoodMenuSchema);
