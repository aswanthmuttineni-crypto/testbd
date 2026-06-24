import { Router } from 'express';
import Notice from '../models/Notice.js';
import { protect, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/public', async (_req, res, next) => {
  try { res.json(await Notice.find().sort({ pinned: -1, createdAt: -1 }).limit(20)); } catch (error) { next(error); }
});

router.get('/', protect, requireAdmin, async (_req, res, next) => {
  try { res.json(await Notice.find().sort({ createdAt: -1 })); } catch (error) { next(error); }
});

router.post('/', protect, requireAdmin, async (req, res, next) => {
  try { res.status(201).json(await Notice.create(req.body)); } catch (error) { next(error); }
});

router.put('/:id', protect, requireAdmin, async (req, res, next) => {
  try {
    const notice = await Notice.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!notice) return res.status(404).json({ message: 'Notice not found' });
    res.json(notice);
  } catch (error) { next(error); }
});

router.delete('/:id', protect, requireAdmin, async (req, res, next) => {
  try { await Notice.findByIdAndDelete(req.params.id); res.status(204).end(); } catch (error) { next(error); }
});

export default router;
