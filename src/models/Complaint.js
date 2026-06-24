import mongoose from 'mongoose';

const ComplaintSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['OPEN','IN_PROGRESS','RESOLVED'], default: 'OPEN' },
  priority: { type: String, enum: ['LOW','MEDIUM','HIGH'], default: 'MEDIUM' }
}, { timestamps: true });

export default mongoose.model('Complaint', ComplaintSchema);
