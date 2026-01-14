import { Router } from "express";

export default function createMerchantRoutes({
  db,
  io,
  stores,
  pushActivity,
  useDbForProducts,
}) {
  const router = Router();

  // DEV auth middleware (token=email)
  const authMerchant = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const token = authHeader.substring(7);
    const merchant = stores.merchants.get(token);
    if (!merchant) return res.status(401).json({ message: "Invalid token" });
    req.merchant = merchant;
    next();
  };

  async function getProductsForMerchant(merchantId) {
    if (!useDbForProducts) {
      return Array.from(stores.products.values()).filter((p) => p.merchantId === merchantId);
    }

    const [rows] = await db.query(
      `SELECT id, merchant_id AS merchantId, name, price, stock, image, description, category,
              created_at AS createdAt, updated_at AS updatedAt
         FROM products
        WHERE merchant_id = ?
        ORDER BY updated_at DESC`,
      [merchantId]
    );
    return rows;
  }

  async function upsertProductDb(merchantId, payload) {
    const productId = payload.id || `prod-${Date.now()}`;

    await db.query(
      `INSERT INTO products (id, merchant_id, name, price, stock, image, description, category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name=VALUES(name),
         price=VALUES(price),
         stock=VALUES(stock),
         image=VALUES(image),
         description=VALUES(description),
         category=VALUES(category)`,
      [
        productId,
        merchantId,
        payload.name,
        Number(payload.price || 0),
        Number(payload.stock || 0),
        payload.image || null,
        payload.description || null,
        payload.category || null,
      ]
    );

    const [rows] = await db.query(
      `SELECT id, merchant_id AS merchantId, name, price, stock, image, description, category,
              created_at AS createdAt, updated_at AS updatedAt
         FROM products
        WHERE id = ?`,
      [productId]
    );

    return rows[0];
  }

  async function deleteProductDb(productId) {
    await db.query("DELETE FROM products WHERE id = ?", [productId]);
  }

  // Login
  router.post("/auth/login", (req, res) => {
    const { email, password } = req.body;

    const merchant = stores.merchants.get(email);
    if (!merchant || merchant.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json({
      token: merchant.email,
      user: {
        id: merchant.id,
        email: merchant.email,
        name: merchant.name,
        role: merchant.role,
      },
    });
  });

  // List products
  router.get("/merchant/products", authMerchant, async (req, res) => {
    try {
      const list = await getProductsForMerchant(req.merchant.id);
      res.json(list);
    } catch (e) {
      res.status(500).json({ message: "Failed to list products", error: e.message });
    }
  });

  // Create/Update product
  router.post("/merchant/products", authMerchant, async (req, res) => {
    try {
      const { id, name, price, stock, image, description, category } = req.body;
      if (!name) return res.status(400).json({ message: "name is required" });

      if (useDbForProducts) {
        const saved = await upsertProductDb(req.merchant.id, {
          id,
          name,
          price,
          stock,
          image,
          description,
          category,
        });

        io.emit("product:added", saved);

        pushActivity({
          id: Date.now(),
          type: "product",
          message: `${saved.name} ${id ? "updated" : "added"} by merchant`,
          timestamp: new Date().toISOString(),
        });

        return res.json(saved);
      }

      // In-memory fallback
      const productId = id || `prod-${Date.now()}`;
      const product = {
        id: productId,
        name,
        price: Number(price),
        stock: Number(stock),
        image,
        description,
        category,
        merchantId: req.merchant.id,
        createdAt: stores.products.get(productId)?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      stores.products.set(productId, product);
      io.emit("product:added", product);

      pushActivity({
        id: Date.now(),
        type: "product",
        message: `${product.name} ${id ? "updated" : "added"} by merchant`,
        timestamp: new Date().toISOString(),
      });

      res.json(product);
    } catch (e) {
      res.status(500).json({ message: "Failed to save product", error: e.message });
    }
  });

  // Update product
  router.patch("/merchant/products/:id", authMerchant, async (req, res) => {
    try {
      const { id } = req.params;

      if (useDbForProducts) {
        const [rows] = await db.query(
          "SELECT id, merchant_id AS merchantId, name, price, stock, image, description, category FROM products WHERE id = ? AND merchant_id = ?",
          [id, req.merchant.id]
        );
        const existing = rows[0];
        if (!existing) return res.status(404).json({ message: "Product not found" });

        const saved = await upsertProductDb(req.merchant.id, {
          id,
          name: req.body.name ?? existing.name,
          price: req.body.price ?? existing.price,
          stock: req.body.stock ?? existing.stock,
          image: req.body.image ?? existing.image,
          description: req.body.description ?? existing.description,
          category: req.body.category ?? existing.category,
        });

        if (req.body.price !== undefined) {
          io.emit("price:changed", { productId: id, productName: saved.name, newPrice: saved.price });
        }
        if (req.body.stock !== undefined) {
          io.emit("stock:changed", { productId: id, productName: saved.name, stock: saved.stock });
        }

        return res.json(saved);
      }

      const product = stores.products.get(id);
      if (!product) return res.status(404).json({ message: "Product not found" });

      const updated = { ...product, ...req.body, id, updatedAt: new Date().toISOString() };
      stores.products.set(id, updated);

      if (req.body.price !== undefined) {
        io.emit("price:changed", { productId: id, productName: updated.name, newPrice: updated.price });
      }
      if (req.body.stock !== undefined) {
        io.emit("stock:changed", { productId: id, productName: updated.name, stock: updated.stock });
      }

      res.json(updated);
    } catch (e) {
      res.status(500).json({ message: "Failed to update product", error: e.message });
    }
  });

  // Delete product
  router.delete("/merchant/products/:id", authMerchant, async (req, res) => {
    try {
      const { id } = req.params;

      if (useDbForProducts) {
        const [rows] = await db.query("SELECT id FROM products WHERE id = ? AND merchant_id = ?", [
          id,
          req.merchant.id,
        ]);
        if (!rows[0]) return res.status(404).json({ message: "Product not found" });

        await deleteProductDb(id);
        io.emit("product:removed", { productId: id });
        return res.json({ message: "Product deleted" });
      }

      if (!stores.products.has(id)) return res.status(404).json({ message: "Product not found" });

      stores.products.delete(id);
      io.emit("product:removed", { productId: id });
      res.json({ message: "Product deleted" });
    } catch (e) {
      res.status(500).json({ message: "Failed to delete product", error: e.message });
    }
  });

  // Orders (still in-memory)
  router.get("/merchant/orders", authMerchant, (_req, res) => {
    res.json(Array.from(stores.orders.values()));
  });

  router.patch("/merchant/orders/:id", authMerchant, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const order = stores.orders.get(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.status = status;
    order.updatedAt = new Date().toISOString();

    stores.orders.set(id, order);
    io.emit("order:updated", order);

    res.json(order);
  });

  return router;
}
