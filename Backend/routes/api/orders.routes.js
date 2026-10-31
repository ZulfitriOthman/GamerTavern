// Backend/routes/api/orders.routes.js — customer-facing order history/detail.
// Ownership is always checked against the authenticated user's id, never
// against an id supplied by the client.
import { Router } from "express";
import { requireAuth } from "../../modules/restAuth.module.js";
import { parsePagination, paginationMeta } from "../../modules/pagination.module.js";
import { decryptField } from "../../modules/encryption.module.js";
import { fulfilmentTypeForShippingCode } from "../../modules/fulfilment.module.js";

export default function createOrdersRoutes({ db }) {
  const router = Router();
  router.use(requireAuth);

  router.get("/", async (req, res) => {
    try {
      const { page, limit, offset } = parsePagination(req);

      const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM ORDERS WHERE user_id = ?`, [req.user.sub]);
      const [rows] = await db.query(
        `SELECT o.id, o.order_number, o.subtotal, o.discount_total, o.shipping_total, o.grand_total, o.currency,
                o.payment_status, o.status, o.placed_at, o.created_at,
                (SELECT COUNT(DISTINCT merchant_id) FROM MERCHANT_ORDERS WHERE order_id = o.id) AS merchant_count,
                (SELECT COALESCE(SUM(oi.quantity), 0)
                   FROM ORDER_ITEMS oi JOIN MERCHANT_ORDERS mo ON mo.id = oi.merchant_order_id
                  WHERE mo.order_id = o.id) AS item_count
           FROM ORDERS o
          WHERE o.user_id = ?
          ORDER BY o.created_at DESC
          LIMIT ? OFFSET ?`,
        [req.user.sub, limit, offset]
      );
      return res.json({ success: true, data: { items: rows, pagination: paginationMeta({ page, limit, total }) } });
    } catch (err) {
      console.error("[orders GET] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load orders." });
    }
  });

  router.get("/:id", async (req, res) => {
    try {
      const [orderRows] = await db.query(
        `SELECT o.id, o.order_number, o.user_id, o.shipping_address_id, o.billing_address_id, o.shipping_method_id, o.coupon_id, o.delivery_instructions,
                o.subtotal, o.discount_total, o.shipping_total, o.grand_total, o.currency, o.payment_status, o.status, o.placed_at, o.created_at, o.updated_at,
                sm.name AS shipping_method_name, sm.code AS shipping_method_code,
                ca.label AS address_label, ca.recipient_name AS address_recipient_name, ca.phone AS address_phone,
                ca.address_line1 AS address_line1, ca.address_line2 AS address_line2, ca.district AS address_district,
                ca.mukim AS address_mukim, ca.village AS address_village, ca.postcode AS address_postcode
           FROM ORDERS o
           LEFT JOIN SHIPPING_METHODS sm ON sm.id = o.shipping_method_id
           LEFT JOIN CUSTOMER_ADDRESSES ca ON ca.id = o.shipping_address_id
          WHERE o.id = ? AND o.user_id = ? LIMIT 1`,
        [req.params.id, req.user.sub]
      );
      const order = orderRows[0];
      if (!order) return res.status(404).json({ success: false, message: "Order not found." });

      // Fulfilment (point 12): a real Delivery address + instructions +
      // optional reference photo, or — for Pickup — each merchant's own
      // registered address if they have one on file (never invented). Never
      // exposed cross-order/cross-merchant — everything below is already
      // scoped to this order via order.id, itself already ownership-checked
      // above (order.user_id = req.user.sub).
      const fulfilmentType = fulfilmentTypeForShippingCode(order.shipping_method_code);
      const deliveryAddress =
        fulfilmentType === "DELIVERY" && order.address_line1
          ? {
              label: order.address_label,
              recipientName: order.address_recipient_name,
              phone: order.address_phone,
              addressLine1: order.address_line1,
              addressLine2: order.address_line2,
              district: order.address_district,
              mukim: order.address_mukim,
              village: order.address_village,
              postcode: order.address_postcode,
            }
          : null;

      const [attachmentRows] = await db.query(`SELECT file_url, file_type FROM ORDER_DELIVERY_ATTACHMENTS WHERE order_id = ? LIMIT 1`, [order.id]);
      const deliveryReferencePhoto = fulfilmentType === "DELIVERY" && attachmentRows[0] ? { fileUrl: attachmentRows[0].file_url, fileType: attachmentRows[0].file_type } : null;

      let pickupLocations = [];
      if (fulfilmentType === "PICKUP") {
        const [pickupRows] = await db.query(
          `SELECT DISTINCT m.id AS merchant_id, m.display_name AS merchant_name,
                  ma.label, ma.address_line1, ma.district, ma.mukim, ma.village, ma.postcode
             FROM MERCHANT_ORDERS mo
             JOIN MERCHANTS m ON m.id = mo.merchant_id
             LEFT JOIN MERCHANT_ADDRESSES ma ON ma.merchant_id = m.id AND ma.is_default = 1
            WHERE mo.order_id = ?`,
          [order.id]
        );
        pickupLocations = pickupRows.map((r) => ({
          merchantName: r.merchant_name,
          address: r.address_line1
            ? { label: r.label, addressLine1: r.address_line1, district: r.district, mukim: r.mukim, village: r.village, postcode: r.postcode }
            : null,
        }));
      }

      const [items] = await db.query(
        `SELECT oi.id, oi.product_id, oi.variant_id, oi.product_name_snapshot, oi.sku_snapshot,
                oi.unit_price_snapshot, oi.quantity, oi.line_total,
                mo.merchant_order_number, mo.status AS merchant_order_status, m.display_name AS merchant_name
           FROM ORDER_ITEMS oi
           JOIN MERCHANT_ORDERS mo ON mo.id = oi.merchant_order_id
           JOIN MERCHANTS m ON m.id = mo.merchant_id
          WHERE oi.order_id = ?`,
        [order.id]
      );

      const [history] = await db.query(
        `SELECT old_status, new_status, changed_by_type, note, created_at
           FROM ORDER_STATUS_HISTORY WHERE order_id = ? ORDER BY created_at ASC`,
        [order.id]
      );

      const [shipments] = await db.query(
        `SELECT s.tracking_number, s.carrier, s.status, s.shipped_at, s.delivered_at, mo.merchant_order_number
           FROM SHIPMENTS s JOIN MERCHANT_ORDERS mo ON mo.id = s.merchant_order_id
          WHERE mo.order_id = ?`,
        [order.id]
      );

      // Bank transfer instructions (Merchant Payments Stage 2) — ownership
      // is already enforced above (order.user_id = req.user.sub), and this
      // is the ONLY place the full account number is ever decrypted for a
      // customer: from the order's own MERCHANT_ORDER_PAYMENTS snapshot,
      // never from MERCHANT_BANK_DETAILS directly, and never through a
      // general lookup endpoint. Snapshot data is used, not the merchant's
      // current (possibly since-changed) bank details.
      const [bankRows] = await db.query(
        `SELECT mop.id, mop.status, mop.amount, mop.currency, mop.reference, mop.confirmed_at,
                mop.snapshot_bank_name, mop.snapshot_bank_other_label, mop.snapshot_display_name, mop.snapshot_account_name,
                mop.snapshot_account_number_ciphertext, mop.snapshot_account_number_iv, mop.snapshot_account_number_auth_tag,
                mop.snapshot_account_number_last4,
                mo.merchant_order_number, m.display_name AS merchant_name
           FROM MERCHANT_ORDER_PAYMENTS mop
           JOIN MERCHANT_ORDERS mo ON mo.id = mop.merchant_order_id
           JOIN MERCHANTS m ON m.id = mo.merchant_id
          WHERE mo.order_id = ? AND mop.payment_method = 'BANK_TRANSFER'`,
        [order.id]
      );
      const bankTransferPayments = bankRows.map((p) => {
        let accountNumber = null;
        if (p.snapshot_account_number_ciphertext) {
          try {
            accountNumber = decryptField({
              ciphertext: p.snapshot_account_number_ciphertext,
              iv: p.snapshot_account_number_iv,
              authTag: p.snapshot_account_number_auth_tag,
            });
          } catch {
            accountNumber = null;
          }
        }
        return {
          merchantOrderNumber: p.merchant_order_number,
          merchantName: p.merchant_name,
          status: p.status,
          amount: p.amount,
          currency: p.currency,
          reference: p.reference,
          bank: p.snapshot_bank_name,
          bankOtherLabel: p.snapshot_bank_other_label,
          displayName: p.snapshot_display_name,
          accountName: p.snapshot_account_name,
          accountNumber,
          accountNumberLast4: p.snapshot_account_number_last4,
          confirmedAt: p.confirmed_at,
        };
      });

      // Pay on Delivery / Pay on Pickup — no bank snapshot to decrypt, just
      // the amount and confirmation state. Kept as a separate array (rather
      // than merged into bankTransferPayments) so OrderConfirmationPage.jsx
      // can render each method's own, differently-worded status copy.
      const [offlineRows] = await db.query(
        `SELECT mop.payment_method, mop.status, mop.amount, mop.currency, mop.confirmed_at,
                mo.merchant_order_number, m.display_name AS merchant_name
           FROM MERCHANT_ORDER_PAYMENTS mop
           JOIN MERCHANT_ORDERS mo ON mo.id = mop.merchant_order_id
           JOIN MERCHANTS m ON m.id = mo.merchant_id
          WHERE mo.order_id = ? AND mop.payment_method IN ('PAY_ON_DELIVERY', 'PAY_ON_PICKUP')`,
        [order.id]
      );
      const offlinePayments = offlineRows.map((p) => ({
        merchantOrderNumber: p.merchant_order_number,
        merchantName: p.merchant_name,
        paymentMethod: p.payment_method,
        status: p.status,
        amount: p.amount,
        currency: p.currency,
        confirmedAt: p.confirmed_at,
      }));

      return res.json({
        success: true,
        data: { ...order, items, history, shipments, bankTransferPayments, offlinePayments, fulfilmentType, deliveryAddress, deliveryReferencePhoto, pickupLocations },
      });
    } catch (err) {
      console.error("[orders GET :id] error:", err);
      return res.status(500).json({ success: false, message: "Failed to load order." });
    }
  });

  return router;
}
