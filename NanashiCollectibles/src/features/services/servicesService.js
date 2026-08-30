// Wraps the Socket.IO ack-based contract in Backend/controllers/services.controller.js.
import { emitWithAck } from "../../services/socket/emitWithAck.js";

// services:list — public, active services only.
export function listServices(socket) {
  return emitWithAck(socket, "services:list", {});
}

// enquiries:create — public, no auth required, deliberately not broadcast (PII).
// topic must be one of: general | shop | tcg | esports | service. serviceId is
// required server-side only when topic === "service" — mirrored client-side so the
// form can ask for it before submitting instead of round-tripping a guaranteed
// failure.
export function createEnquiry(socket, { topic, name, email, phone, message, serviceId }) {
  return emitWithAck(socket, "enquiries:create", { topic, name, email, phone, message, serviceId });
}
