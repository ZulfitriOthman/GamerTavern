import express from "express";
import fs from "fs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export default function createClientPortfolioRoutes() {
  const router = express.Router();

  const baseDir = path.join(process.cwd(), "tmp", "client-portfolio");
  const recordsDir = path.join(baseDir, "records");
  const imagesDir = path.join(baseDir, "images");
  const documentsDir = path.join(baseDir, "documents");

  ensureDir(baseDir);
  ensureDir(recordsDir);
  ensureDir(imagesDir);
  ensureDir(documentsDir);

  const storage = multer.diskStorage({
    destination: (_req, file, cb) => {
      const isImage = /^image\//i.test(file.mimetype || "");
      cb(null, isImage ? imagesDir : documentsDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "") || ".bin";
      const safeName = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
      cb(null, safeName);
    },
  });

  const fileFilter = (_req, file, cb) => {
    const mime = (file.mimetype || "").toLowerCase();
    const fileName = (file.originalname || "").toLowerCase();
    const isImage = /^image\/(png|jpeg|jpg|webp|gif)$/i.test(mime) || /\.(png|jpe?g|webp|gif)$/i.test(fileName);
    const isDocument =
      /^(application\/pdf|application\/msword|application\/vnd.openxmlformats-officedocument.wordprocessingml.document|text\/plain)$/i.test(mime) ||
      /\.(pdf|doc|docx|txt)$/i.test(fileName);

    cb(isImage || isDocument ? null : new Error("Only image or document files are allowed."), isImage || isDocument);
  };

  const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "missing token" });
    }

    try {
      if (!process.env.JWT_SECRET) {
        return res.status(500).json({ message: "server misconfigured (JWT_SECRET missing)" });
      }

      req.user = jwt.verify(token, process.env.JWT_SECRET);
      return next();
    } catch {
      return res.status(401).json({ message: "invalid token" });
    }
  }

  router.get("/me", requireAuth, (_req, res) => {
    const userId = String(_req.user?.sub || "unknown");
    const files = fs.readdirSync(recordsDir).filter((name) => name.startsWith(`${userId}-`) && name.endsWith(".json"));
    const records = files
      .map((name) => readJson(path.join(recordsDir, name)))
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json({ ok: true, submissions: records });
  });

  router.post(
    "/submit",
    requireAuth,
    upload.fields([
      { name: "avatar", maxCount: 1 },
      { name: "gallery", maxCount: 8 },
      { name: "documents", maxCount: 8 },
    ]),
    (req, res) => {
      const files = req.files || {};
      const createdAt = new Date().toISOString();
      const userId = String(req.user?.sub || "unknown");
      const submissionId = `${userId}-${Date.now()}`;

      const record = {
        id: submissionId,
        createdAt,
        user: {
          id: req.user?.sub,
          email: req.user?.email,
          name: req.user?.name,
        },
        content: {
          fullName: req.body.fullName || "",
          portfolioTitle: req.body.portfolioTitle || "",
          tagline: req.body.tagline || "",
          about: req.body.about || "",
          preferredTheme: req.body.preferredTheme || "",
          contactEmail: req.body.contactEmail || "",
          contactPhone: req.body.contactPhone || "",
          linkedinUrl: req.body.linkedinUrl || "",
          githubUrl: req.body.githubUrl || "",
          notes: req.body.notes || "",
        },
        files: {
          avatar: (files.avatar || []).map((file) => ({
            originalName: file.originalname,
            savedAs: file.filename,
            path: file.path,
            mimeType: file.mimetype,
            size: file.size,
          })),
          gallery: (files.gallery || []).map((file) => ({
            originalName: file.originalname,
            savedAs: file.filename,
            path: file.path,
            mimeType: file.mimetype,
            size: file.size,
          })),
          documents: (files.documents || []).map((file) => ({
            originalName: file.originalname,
            savedAs: file.filename,
            path: file.path,
            mimeType: file.mimetype,
            size: file.size,
          })),
        },
      };

      fs.writeFileSync(
        path.join(recordsDir, `${submissionId}.json`),
        JSON.stringify(record, null, 2),
        "utf8"
      );

      return res.status(201).json({ ok: true, submission: record });
    }
  );

  return router;
}
