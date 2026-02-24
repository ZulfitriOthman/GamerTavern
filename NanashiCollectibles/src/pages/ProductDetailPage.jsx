// src/pages/ProductDetailPage.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getSocket, connectSocket } from "../socket/socketClient";
import { getCurrentUser, getUsername } from "../authStorage";

const PLACEHOLDER = "/placeholder.png";

const toStr = (v) => (v == null ? "" : String(v)).trim();
const toInt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

// Buffer-safe (same as your VendorShopPage)
function asText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (v?.type === "Buffer" && Array.isArray(v?.data)) {
    return new TextDecoder().decode(new Uint8Array(v.data));
  }
  if (v instanceof ArrayBuffer)
    return new TextDecoder().decode(new Uint8Array(v));
  if (v instanceof Uint8Array) return new TextDecoder().decode(v);
  if (Buffer.isBuffer?.(v)) return v.toString("utf8");
  return String(v);
}

function getApiBase() {
  const env =
    import.meta?.env?.VITE_API_BASE && String(import.meta.env.VITE_API_BASE);
  if (env) return env;

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;

    if (
      hostname === "nanashicollectibles.com" ||
      hostname === "www.nanashicollectibles.com" ||
      hostname === "sidequest.nanashicollectibles.com"
    ) {
      return window.location.origin + "/api";
    }

    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `http://${hostname}:3001`;
    }
  }

  return "http://localhost:3001";
}

const API_BASE = getApiBase();
const ASSET_BASE = API_BASE.replace(/\/api\/?$/, "");

function resolveImageSrc(url) {
  const s = toStr(url);
  if (!s) return PLACEHOLDER;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/public/")) return `${ASSET_BASE}${s}`;
  if (s.startsWith("/")) return s;
  return PLACEHOLDER;
}

export default function ProductDetailPage({ addToCart }) {
  const { id } = useParams(); // product id from URL
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState("");
  const [product, setProduct] = useState(null);

  const emitAsync = (event, payload) =>
    new Promise((resolve) => {
      const s = getSocket();
      if (!s?.connected)
        return resolve({ success: false, message: "Socket not connected." });
      s.emit(event, payload, (res) => resolve(res));
    });

  // Load current user
  useEffect(() => {
    const user = getCurrentUser();
    if (!user?.id) {
      navigate("/login");
      return;
    }
    setCurrentUser(user);
  }, [navigate]);

  // Ensure socket
  useEffect(() => {
    const username =
      getUsername() ||
      (currentUser?.name ? String(currentUser.name) : null);

    connectSocket(username);
  }, [currentUser?.name]);

  // Load product by reusing product:list
  useEffect(() => {
    if (!currentUser?.id) return;

    const s = getSocket();
    if (!s) return;

    const onConnect = async () => {
      setIsSocketConnected(true);
      setServerError("");
      await fetchProduct();
    };

    const onDisconnect = () => setIsSocketConnected(false);

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);

    // initial
    setIsSocketConnected(!!s.connected);
    if (s.connected) fetchProduct();

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, id]);

  const fetchProduct = async () => {
    setLoading(true);
    setServerError("");

    // ✅ reuse list (no backend changes)
    const res = await emitAsync("product:list", {
      currentUser: { id: currentUser.id, role: currentUser.role },
      // If vendor role, your backend already supports vendorId filter (based on your VendorShopPage)
      ...(String(currentUser?.role || "").toUpperCase() === "VENDOR"
        ? { vendorId: currentUser.id }
        : {}),
    });

    setLoading(false);

    if (!res?.success) {
      setServerError(res?.message || "Failed to load products.");
      return;
    }

    const rows = Array.isArray(res.data) ? res.data : [];
    const pid = String(id);

    const r = rows.find((x) => String(x.id ?? x.ID) === pid);
    if (!r) {
      setProduct(null);
      setServerError("Product not found (or you don’t have access).");
      return;
    }

    setProduct({
      id: r.id ?? r.ID,
      vendor_id: r.vendor_id ?? r.VENDOR_ID,
      name: toStr(r.name ?? r.NAME),
      code: toStr(r.code ?? r.CODE),
      conditional: toStr(r.conditional ?? r.CONDITIONAL),
      price: toInt(r.price ?? r.PRICE),
      stock: toInt(r.stock_quantity ?? r.STOCK_QUANTITY),
      image_url: asText(r.image_url ?? r.IMAGE_URL),
      description: asText(r.description ?? r.DESCRIPTION),
      created_at:
        r?.created_at || r?.CREATED_AT
          ? new Date(r.created_at || r.CREATED_AT)
          : null,
    });
  };

  const canBuy = useMemo(() => toInt(product?.stock) > 0, [product]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      {/* Top bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-xl border border-emerald-900/40 bg-slate-950/60 px-3 py-2 font-serif text-xs text-emerald-100/80 hover:border-emerald-400"
          >
            ← Back
          </button>

          <span
            className={[
              "rounded-full border px-3 py-1 font-serif text-[10px] uppercase tracking-wide",
              isSocketConnected
                ? "border-emerald-600/40 bg-emerald-950/30 text-emerald-200"
                : "border-rose-600/40 bg-rose-950/30 text-rose-200",
            ].join(" ")}
            title="Socket connection status"
          >
            {isSocketConnected ? "Live" : "Offline"}
          </span>
        </div>

        <Link
          to="/cart"
          className="rounded-xl border border-amber-700/40 bg-amber-950/20 px-3 py-2 font-serif text-xs text-amber-100/90 hover:border-amber-500"
        >
          Go to Cart →
        </Link>
      </div>

      {serverError ? (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {serverError}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-emerald-900/40 bg-slate-950/40 p-6 font-serif text-sm text-emerald-100/70">
          Loading product...
        </div>
      ) : !product ? (
        <div className="rounded-2xl border border-emerald-900/40 bg-slate-950/40 p-6 font-serif text-sm text-emerald-100/70">
          Product not available.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Image */}
          <div className="overflow-hidden rounded-2xl border border-emerald-900/40 bg-slate-950/40">
            <div className="relative aspect-[1/1] md:aspect-[4/3]">
              <img
                src={resolveImageSrc(product.image_url)}
                alt={product.name}
                className="h-full w-full object-contain bg-slate-950/60"
                onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
              />
            </div>
          </div>

          {/* Details */}
          <div className="rounded-2xl border border-emerald-900/40 bg-gradient-to-br from-slate-950 via-emerald-950/15 to-slate-950 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h1 className="font-serif text-xl font-bold text-emerald-100">
                {product.name}
              </h1>

              <span className="rounded-full border border-emerald-500/60 bg-slate-950/70 px-3 py-1 font-serif text-[11px] font-semibold text-emerald-300">
                BND {toInt(product.price).toFixed(2)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full border border-emerald-900/40 bg-slate-950/60 px-2 py-0.5 font-serif text-emerald-200/80">
                Code: {product.code || "-"}
              </span>

              {product.conditional ? (
                <span className="rounded-full border border-amber-600/40 bg-amber-950/15 px-2 py-0.5 font-serif text-amber-200/90">
                  {product.conditional}
                </span>
              ) : null}

              <span className="rounded-full border border-emerald-900/40 bg-slate-950/60 px-2 py-0.5 font-serif text-emerald-200/80">
                Stock: {toInt(product.stock)}
              </span>

              {product.created_at ? (
                <span className="rounded-full border border-emerald-900/40 bg-slate-950/60 px-2 py-0.5 font-serif text-emerald-200/70">
                  Added: {product.created_at.toLocaleDateString()}
                </span>
              ) : null}
            </div>

            <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-emerald-700/30 to-transparent" />

            <div className="mt-4">
              <p className="mb-2 font-serif text-[11px] uppercase tracking-[0.2em] text-emerald-200/70">
                Description
              </p>

              {product.description ? (
                <p className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-emerald-100/70">
                  {product.description}
                </p>
              ) : (
                <p className="font-serif text-sm italic text-emerald-200/50">
                  No description provided.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                addToCart({
                  id: product.id,
                  name: product.name,
                  price: toInt(product.price),
                  image: resolveImageSrc(product.image_url),
                  stock: toInt(product.stock),
                })
              }
              disabled={!canBuy}
              className={[
                "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 font-serif text-xs font-semibold uppercase tracking-wide transition-all",
                "focus:outline-none focus:ring-2 focus:ring-emerald-500/50",
                !canBuy
                  ? "cursor-not-allowed border-emerald-900/40 bg-slate-950/40 text-emerald-100/40"
                  : "border-emerald-500/50 bg-gradient-to-r from-emerald-950/40 to-slate-950 text-emerald-100 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-900/20 active:translate-y-[1px]",
              ].join(" ")}
            >
              {!canBuy ? "Out of Stock" : "Add to Cart"}
              <span className="text-emerald-200/70">➜</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
