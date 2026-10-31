// Backend/routes/api/addresses.routes.js
//
// Minimal customer address CRUD — list + create only, no edit/delete/manage
// screen. This exists purely so checkout can offer "Use a saved address"
// for a returning customer; it is deliberately NOT a full address-book
// feature (per the product spec: "do not build an entire address-book
// system unless necessary for this stage"). CUSTOMER_ADDRESSES already
// existed (Database/schema/005_orders_checkout.sql) — checkout.routes.js
// already validated a client-supplied shippingAddressId against it, but
// nothing could create one until now.
import { Router } from "express";
import { requireAuth } from "../../modules/restAuth.module.js";

function toStr(v) {
  return v == null ? "" : String(v).trim();
}

function toAddressView(row) {
  return {
    id: row.id,
    label: row.label,
    recipientName: row.recipient_name,
    phone: row.phone,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    district: row.district,
    mukim: row.mukim,
    village: row.village,
    postcode: row.postcode,
    countryCode: row.country_code,
    isDefaultShipping: Boolean(row.is_default_shipping),
  };
}

export default function createAddressesRoutes({ db }) {
  const router = Router();

  router.get("/", requireAuth, async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT id, label, recipient_name, phone, address_line1, address_line2, district, mukim, village, postcode, country_code, is_default_shipping
           FROM CUSTOMER_ADDRESSES WHERE user_id = ? ORDER BY is_default_shipping DESC, created_at DESC`,
        [req.user.sub]
      );
      return res.json({ success: true, data: rows.map(toAddressView) });
    } catch (err) {
      console.error("[addresses GET] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load addresses." });
    }
  });

  router.post("/", requireAuth, async (req, res) => {
    try {
      const { label, recipientName, phone, addressLine1, addressLine2, district, mukim, village, postcode, setDefault } = req.body || {};

      const recipient = toStr(recipientName);
      const line1 = toStr(addressLine1);
      const phoneStr = toStr(phone);
      if (!recipient) return res.status(400).json({ success: false, message: "Recipient name is required." });
      if (!line1) return res.status(400).json({ success: false, message: "Address line 1 is required." });
      if (!phoneStr) return res.status(400).json({ success: false, message: "Contact number is required." });

      const userId = req.user.sub;

      if (setDefault) {
        await db.execute(`UPDATE CUSTOMER_ADDRESSES SET is_default_shipping = 0 WHERE user_id = ?`, [userId]);
      }

      const [result] = await db.execute(
        `INSERT INTO CUSTOMER_ADDRESSES
           (user_id, label, recipient_name, phone, address_line1, address_line2, district, mukim, village, postcode, is_default_shipping)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          toStr(label) || null,
          recipient,
          phoneStr,
          line1,
          toStr(addressLine2) || null,
          toStr(district) || null,
          toStr(mukim) || null,
          toStr(village) || null,
          toStr(postcode) || null,
          setDefault ? 1 : 0,
        ]
      );

      const [[row]] = await db.query(
        `SELECT id, label, recipient_name, phone, address_line1, address_line2, district, mukim, village, postcode, country_code, is_default_shipping
           FROM CUSTOMER_ADDRESSES WHERE id = ?`,
        [result.insertId]
      );
      return res.status(201).json({ success: true, data: toAddressView(row) });
    } catch (err) {
      console.error("[addresses POST] error:", err);
      return res.status(500).json({ success: false, message: "Failed to save address." });
    }
  });

  return router;
}
