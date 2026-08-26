// Backend/modules/jwt.module.js
// Single source of truth for JWT secret resolution + sign/verify, shared by REST auth
// (routes/api/auth.routes.js) and Socket.IO handshake authentication (server.js).
import jwt from "jsonwebtoken";
import crypto from "crypto";

let cachedDevJwtSecret = null;

export function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    throw new Error("JWT_SECRET is not set in environment variables");
  }

  if (!cachedDevJwtSecret) {
    cachedDevJwtSecret = crypto.randomBytes(48).toString("hex");
    console.warn(
      "[jwt] JWT_SECRET is missing. Using temporary in-memory dev secret. Tokens will reset when server restarts."
    );
  }

  return cachedDevJwtSecret;
}

export function signToken(payload, options = {}) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    ...options,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}
