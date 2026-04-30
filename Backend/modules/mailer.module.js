// Backend/modules/mailer.module.js
import nodemailer from "nodemailer";

let transporter = null;
let verified = false;

function buildTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn(
      "[mailer] SMTP_HOST/SMTP_USER/SMTP_PASS not configured — emails will be skipped.",
    );
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = SSL, 587 = STARTTLS
    auth: { user, pass },
  });
}

export function getTransporter() {
  if (!transporter) transporter = buildTransporter();
  return transporter;
}

export async function verifyMailer() {
  const t = getTransporter();
  if (!t) return false;
  try {
    await t.verify();
    verified = true;
    console.log("[mailer] ✅ SMTP transporter verified");
    return true;
  } catch (err) {
    console.error("[mailer] ❌ SMTP verification failed:", err.message);
    return false;
  }
}

/**
 * Send an email to many recipients via BCC (single connection per batch).
 * Recipients are deduped + filtered to valid-looking addresses.
 */
export async function sendBulkEmail({ recipients, subject, html, text }) {
  const t = getTransporter();
  if (!t) return { sent: 0, skipped: true, reason: "SMTP not configured" };

  const from =
    process.env.SMTP_FROM ||
    `"Gamer Tavern" <${process.env.SMTP_USER}>`;

  const clean = Array.from(
    new Set(
      (recipients || [])
        .map((e) => String(e || "").trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
    ),
  );

  if (!clean.length) return { sent: 0, skipped: true, reason: "No valid recipients" };

  const BATCH = 50;
  let sent = 0;
  for (let i = 0; i < clean.length; i += BATCH) {
    const batch = clean.slice(i, i + BATCH);
    try {
      await t.sendMail({
        from,
        to: from, // visible "to"
        bcc: batch, // hide recipient list
        subject,
        text,
        html,
      });
      sent += batch.length;
    } catch (err) {
      console.error("[mailer] batch send failed:", err.message);
    }
  }
  return { sent, total: clean.length };
}

export function isMailerVerified() {
  return verified;
}
