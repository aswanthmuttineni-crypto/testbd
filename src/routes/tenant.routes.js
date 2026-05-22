import { Router } from "express";
import Tenant from "../models/Tenant.js";
import Room from "../models/Room.js";
import { protect } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = Router();
router.use(protect);

function fileMeta(file) {
  if (!file) return undefined;
  return { filename: file.originalname, path: `/uploads/${file.filename}`, mimetype: file.mimetype };
}

function tenantPayload(body) {
  const allowed = [
    "name",
    "phone",
    "email",
    "aadhaarNo",
    "guardianName",
    "guardianPhone",
    "address",
    "roomId",
    "bedNo",
    "joiningDate",
    "advanceAmount",
    "monthlyRent",
    "status",
    "notes"
  ];

  return allowed.reduce((payload, key) => {
    if (body[key] !== undefined) payload[key] = body[key];
    return payload;
  }, {});
}

async function validateBed({ roomId, bedNo, tenantId }) {
  const room = await Room.findById(roomId);
  if (!room) return "Room not found";
  if (Number(bedNo) < 1 || Number(bedNo) > room.capacity) return "Bed number is outside room capacity";
  const query = {
    roomId,
    bedNo,
    status: "ACTIVE"
  };
  if (tenantId) query._id = { $ne: tenantId };
  const occupied = await Tenant.exists(query);
  return occupied ? "This bed is already assigned" : "";
}

router.get("/", async (_req, res, next) => {
  try {
    const tenants = await Tenant.find().populate("roomId", "roomNo floor capacity").sort({ createdAt: -1 });
    res.json(tenants);
  } catch (error) {
    next(error);
  }
});

router.post("/", upload.single("idProof"), async (req, res, next) => {
  try {
    const message = await validateBed(req.body);
    if (message) return res.status(400).json({ message });
    const tenant = await Tenant.create({ ...tenantPayload(req.body), idProof: fileMeta(req.file) });
    res.status(201).json(await tenant.populate("roomId", "roomNo floor capacity"));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", upload.single("idProof"), async (req, res, next) => {
  try {
    const message = await validateBed({ ...req.body, tenantId: req.params.id });
    if (message) return res.status(400).json({ message });
    const patch = tenantPayload(req.body);
    if (req.file) patch.idProof = fileMeta(req.file);
    const tenant = await Tenant.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true }).populate("roomId", "roomNo floor capacity");
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    res.json(tenant);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await Tenant.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
