import { Router } from 'express';
import Complaint from '../models/Complaint.js';
import { protect, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get('/me', async (req, res, next) => {
  try { res.json(await Complaint.find({ tenantId: req.user.id }).sort({ createdAt: -1 })); } catch (error) { next(error); }
});

router.get('/', requireAdmin, async (_req, res, next) => {
  try { res.json(await Complaint.find().sort({ createdAt: -1 })); } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const payload = { ...req.body };
    if (req.user) payload.tenantId = req.user.id;
    const complaint = await Complaint.create(payload);
    res.status(201).json(complaint);
  } catch (error) { next(error); }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const complaint = await Complaint.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
    res.json(complaint);
  } catch (error) { next(error); }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try { await Complaint.findByIdAndDelete(req.params.id); res.status(204).end(); } catch (error) { next(error); }
});

export default router;
