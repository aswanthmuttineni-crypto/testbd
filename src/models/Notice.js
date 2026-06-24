import mongoose from 'mongoose';

const NoticeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String },
  category: { type: String },
  pinned: { type: Boolean, default: false },
  author: { type: String }
}, { timestamps: true });

export default mongoose.model('Notice', NoticeSchema);
