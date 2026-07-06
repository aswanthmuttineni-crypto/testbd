import dotenv from 'dotenv';
import { connectDb } from '../src/config/db.js';
import Complaint from '../src/models/Complaint.js';
import Tenant from '../src/models/Tenant.js';
import User from '../src/models/User.js';

dotenv.config();
await connectDb();

const complaints = await Complaint.find({ tenantId: { $exists: true } });
let fixed = 0;

for (const c of complaints) {
  // Check if tenantId already points to a valid Tenant
  const isTenant = await Tenant.exists({ _id: c.tenantId });
  if (isTenant) continue;

  // Try to find the User, then match to Tenant by email
  const user = await User.findById(c.tenantId).select('email');
  if (!user) continue;

  const tenant = await Tenant.findOne({ email: user.email }).select('_id');
  if (!tenant) continue;

  await Complaint.findByIdAndUpdate(c._id, { tenantId: tenant._id });
  fixed++;
  console.log(`Fixed complaint ${c._id}: ${user.email} -> tenant ${tenant._id}`);
}

console.log(`Done. Fixed ${fixed} complaints.`);
process.exit(0);
