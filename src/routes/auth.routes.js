import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import AdminRegistrationCode from "../models/AdminRegistrationCode.js";
import { protect, requireAdmin } from "../middleware/auth.js";
import { sendVerificationCode } from "../utils/messageDelivery.js";

const router = Router();

function sign(user) {
  return jwt.sign(
    { id: user._id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "7d" }
  );
}

function cleanEmail(email = "") {
  return email.trim().toLowerCase();
}

function cleanPhone(phone = "") {
  return phone.replace(/[^\d]/g, "");
}

function createCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

router.post("/register", async (req, res, next) => {
  try {
    const { name, password } = req.body;
    const email = cleanEmail(req.body.email);
    const phone = cleanPhone(req.body.phone);
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: "Email already registered" });

    const code = createCode();
    await AdminRegistrationCode.findOneAndUpdate(
      { email },
      {
        name,
        email,
        phone,
        passwordHash: await bcrypt.hash(password, 10),
        codeHash: await bcrypt.hash(code, 10),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const delivery = await sendVerificationCode({ email, phone, code });
    res.status(202).json({
      message: delivery.sent.length
        ? `Verification code sent by ${delivery.sent.join(" and ")}`
        : "Verification code generated for local development",
      sent: delivery.sent,
      errors: delivery.errors,
      devCode: delivery.devCode
    });
  } catch (error) {
    next(error);
  }
});

router.post("/register/verify", async (req, res, next) => {
  try {
    const email = cleanEmail(req.body.email);
    const code = String(req.body.code || "").trim();
    if (!email || !code) {
      return res.status(400).json({ message: "Email and verification code are required" });
    }

    const pending = await AdminRegistrationCode.findOne({ email });
    if (!pending || pending.expiresAt <= new Date()) {
      return res.status(400).json({ message: "Verification code expired. Please request a new code." });
    }

    if (pending.attempts >= 5) {
      await AdminRegistrationCode.deleteOne({ _id: pending._id });
      return res.status(429).json({ message: "Too many wrong attempts. Please request a new code." });
    }

    const ok = await bcrypt.compare(code, pending.codeHash);
    if (!ok) {
      pending.attempts += 1;
      await pending.save();
      return res.status(400).json({ message: "Invalid verification code" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      await AdminRegistrationCode.deleteOne({ _id: pending._id });
      return res.status(409).json({ message: "Email already registered" });
    }

    const user = await User.create({
      name: pending.name,
      email: pending.email,
      password: pending.passwordHash,
      role: "ADMIN"
    });
    await AdminRegistrationCode.deleteOne({ _id: pending._id });
    res.status(201).json({ token: sign(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    res.json({ token: sign(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    next(error);
  }
});

router.get("/profile", protect, (req, res) => res.json(req.user));

// Called internally after tenant creation — creates a TENANT user account
router.post("/create-tenant-user", protect, requireAdmin, async (req, res, next) => {
  try {
    const { name, email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: "User already exists for this email" });
    const password = Math.random().toString(36).slice(-8);
    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 10),
      plainPassword: password,
      role: "TENANT"
    });
    res.status(201).json({ user: { id: user._id, name: user.name, email: user.email, role: user.role }, password });
  } catch (error) {
    next(error);
  }
});

router.get("/tenant-credentials", protect, requireAdmin, async (req, res, next) => {
  try {
    const tenants = await User.find({ role: "TENANT" }).select("name email plainPassword createdAt").lean();
    res.json(tenants);
  } catch (error) {
    next(error);
  }
});

export default router;
