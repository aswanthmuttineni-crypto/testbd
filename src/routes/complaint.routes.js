import { Router } from 'express';
import Complaint from '../models/Complaint.js';
import Tenant from '../models/Tenant.js';
import { protect, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/me', async (req, res, next) => {
  try {
    const tenant = await Tenant.findOne({ email: req.user.email }).select('_id');
    if (!tenant) return res.json([]);
    res.json(await Complaint.find({ tenantId: tenant._id }).sort({ createdAt: -1 }));
  } catch (error) { next(error); }
});

router.get('/', requireAdmin, async (_req, res, next) => {
  try { res.json(await Complaint.find().populate('tenantId', 'name phone').sort({ createdAt: -1 })); } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const payload = { ...req.body };
    // If tenant user, always resolve tenantId from their profile
    if (req.user?.role === 'TENANT') {
      const tenant = await Tenant.findOne({ email: req.user.email }).select('_id');
      if (tenant) payload.tenantId = tenant._id;
    }
    const complaint = await Complaint.create(payload);
    res.status(201).json(await complaint.populate('tenantId', 'name phone'));
  } catch (error) { next(error); }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { tenantId, ...update } = req.body;
    const complaint = await Complaint.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).populate('tenantId', 'name phone');
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
    res.json(complaint);
  } catch (error) { next(error); }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try { await Complaint.findByIdAndDelete(req.params.id); res.status(204).end(); } catch (error) { next(error); }
});

export default router;
