import { Router } from 'express';
import FoodMenu from '../models/FoodMenu.js';
import { protect, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try { res.json(await FoodMenu.find().sort({ day: 1 })); } catch (error) { next(error); }
});

router.get('/public', async (_req, res, next) => {
  try { res.json(await FoodMenu.find().sort({ day: 1 })); } catch (error) { next(error); }
});

router.post('/', protect, requireAdmin, async (req, res, next) => {
  try { res.status(201).json(await FoodMenu.create(req.body)); } catch (error) { next(error); }
});

router.put('/:id', protect, requireAdmin, async (req, res, next) => {
  try {
    const item = await FoodMenu.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ message: 'Menu item not found' });
    res.json(item);
  } catch (error) { next(error); }
});

router.delete('/:id', protect, requireAdmin, async (req, res, next) => {
  try { await FoodMenu.findByIdAndDelete(req.params.id); res.status(204).end(); } catch (error) { next(error); }
});

export default router;
