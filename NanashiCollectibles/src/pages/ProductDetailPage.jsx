// src/pages/ProductDetailPage.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { getSocket, connectSocket } from "../socket/socketClient";
import { getCurrentUser, getUsername } from "../authStorage";
import { TCG_LIST } from "../data/products";

const PLACEHOLDER = "/placeholder.png";

const toStr = (v) => (v == null ? "" : String(v)).trim();
const toInt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

// Buffer-safe
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

const tcgNameById = (id) => TCG_LIST.find((t) => t.id === id)?.name || id;

function normalizeRole(role) {
  const r = String(role || "USER").toUpperCase();
  return r === "ADMIN" || r === "VENDOR" ? r : "USER";
}

function Badge({ tone = "emerald", children }) {
  const toneMap = {
    emerald: "border-emerald-600/40 bg-emerald-950/25 text-emerald-200",
    amber: "border-amber-600/40 bg-amber-950/20 text-amber-200",
    sky: "border-sky-600/40 bg-sky-950/20 text-sky-200",
    slate: "border-slate-600/30 bg-slate-950/30 text-slate-200",
    rose: "border-rose-600/40 bg-rose-950/25 text-rose-200",
  };

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 font-serif text-[10px] uppercase tracking-[0.18em]",
        toneMap[tone] || toneMap.emerald,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export default function ProductDetailPage({ addToCart }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState("");
  const [product, setProduct] = useState(null);
  const ctaAnimation = "holograms";

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
    setCurrentUser({ ...user, role: normalizeRole(user?.role) });
  }, [navigate]);

  // Ensure socket
  useEffect(() => {
    const username =
      getUsername() || (currentUser?.name ? String(currentUser.name) : null);
    connectSocket(username);
  }, [currentUser?.name]);

  // Socket listeners + initial fetch
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

    const res = await emitAsync("product:list", {
      currentUser: { id: currentUser.id, role: currentUser.role },
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
      seller_name: toStr(r.seller_name ?? r.SELLER_NAME),
      seller_phone: toStr(r.seller_phone ?? r.SELLER_PHONE),
      name: toStr(r.name ?? r.NAME),
      code: toStr(r.code ?? r.CODE),
      conditional: toStr(r.conditional ?? r.CONDITIONAL),
      price: toInt(r.price ?? r.PRICE),
      stock: toInt(r.stock_quantity ?? r.STOCK_QUANTITY),
      image_url: asText(r.image_url ?? r.IMAGE_URL),
      description: asText(r.description ?? r.DESCRIPTION),
      category: toStr(r.category ?? r.CATEGORY),
      created_at:
        r?.created_at || r?.CREATED_AT
          ? new Date(r.created_at || r.CREATED_AT)
          : null,
    });
  };

  const canBuy = useMemo(() => toInt(product?.stock) > 0, [product]);

  const ctaMotionProps = useMemo(() => {
    if (!canBuy || ctaAnimation === "none") return {};

    if (ctaAnimation === "pulse") {
      return {
        animate: { scale: [1, 1.03, 1] },
        transition: { duration: 1.6, repeat: Infinity, ease: "easeInOut" },
      };
    }

    if (ctaAnimation === "float") {
      return {
        animate: { y: [0, -3, 0] },
        transition: { duration: 1.4, repeat: Infinity, ease: "easeInOut" },
      };
    }

    if (ctaAnimation === "glow") {
      return {
        animate: {
          boxShadow: [
            "0 0 0 rgba(16,185,129,0)",
            "0 0 22px rgba(16,185,129,0.35)",
            "0 0 0 rgba(16,185,129,0)",
          ],
        },
        transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
      };
    }

    if (ctaAnimation === "bounce") {
      return {
        animate: { y: [0, -5, 0, -2, 0] },
        transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
      };
    }

    return {};
  }, [ctaAnimation, canBuy]);

  const shopBackHref = useMemo(() => {
    const role = String(currentUser?.role || "USER").toUpperCase();
    const tcg = product?.category ? String(product.category) : "mtg";
    if (role === "VENDOR" || role === "ADMIN") return `/vendor/tcg/${tcg}`;
    return `/user/tcg/${tcg}`;
  }, [currentUser?.role, product?.category]);

  const waLink = useMemo(() => {
    const phone = toStr(product?.seller_phone).replace(/[^\d+]/g, "");
    if (!phone) return "";
    // safe default message
    const msg = encodeURIComponent(
      `Hi, I'm interested in "${toStr(product?.name)}" (Code: ${toStr(
        product?.code,
      )}). Is it still available?`,
    );
    return `https://wa.me/${phone.replace(/^\+/, "")}?text=${msg}`;
  }, [product?.seller_phone, product?.name, product?.code]);

  return (
    <div className="relative mx-auto w-full max-w-6xl px-4 py-6">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -left-32 top-10 h-72 w-72 rounded-full bg-emerald-900/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 top-28 h-80 w-80 rounded-full bg-amber-900/15 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-900/10 blur-3xl" />

      {/* Top bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={isSocketConnected ? "emerald" : "rose"}>
            <span
              className={[
                "mr-2 inline-block h-2 w-2 rounded-full",
                isSocketConnected ? "bg-emerald-400" : "bg-rose-400",
              ].join(" ")}
            />
            {isSocketConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>

        <Link
          to="/cart"
          className="rounded-xl border border-amber-700/40 bg-amber-950/20 px-3 py-2 font-serif text-xs text-amber-100/90 hover:border-amber-500"
        >
          Go to Cart →
        </Link>
      </div>

      {/* Breadcrumb */}
      <div className="mb-4 flex flex-wrap items-center gap-2 font-serif text-xs text-emerald-100/70">
        <Link className="hover:text-emerald-100" to="/">
          Home
        </Link>
        <span className="opacity-50">/</span>
        <Link className="hover:text-emerald-100" to="/shop">
          Shop
        </Link>
        {product?.category ? (
          <>
            <span className="opacity-50">/</span>
            <Link className="hover:text-emerald-100" to={shopBackHref}>
              {tcgNameById(product.category)}
            </Link>
          </>
        ) : null}
        <span className="opacity-50">/</span>
        <span className="text-emerald-100/90">
          {product?.name || "Product"}
        </span>
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
        <div className="grid gap-6 lg:grid-cols-12">
          {/* LEFT: Image */}
          <div className="lg:col-span-7">
            <div className="relative overflow-hidden rounded-2xl border border-emerald-900/40 bg-gradient-to-br from-slate-950 via-emerald-950/10 to-slate-950 shadow-2xl shadow-emerald-900/15">
              {/* frame */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.10),transparent_60%)]" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/35 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
              </div>

              <div className="relative aspect-[1/1] md:aspect-[4/3] overflow-hidden bg-slate-950/50">
                <img
                  src={resolveImageSrc(product.image_url)}
                  alt={product.name}
                  className="h-full w-full object-contain transition-transform duration-700 hover:scale-[1.06]"
                  onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />

                {/* price chip */}
                <div className="absolute bottom-4 right-4 rounded-full border border-emerald-500/50 bg-slate-950/70 px-4 py-2 font-serif text-sm font-bold text-emerald-200 shadow-lg shadow-emerald-900/20">
                  BND {toInt(product.price).toFixed(2)}
                </div>

                {/* stock chip */}
                <div className="absolute bottom-4 left-4">
                  <Badge tone={canBuy ? "emerald" : "rose"}>
                    {canBuy ? `Stock: ${toInt(product.stock)}` : "Out of Stock"}
                  </Badge>
                </div>
              </div>

              {/* small info strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-emerald-900/30 bg-slate-950/50 px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {product.code ? (
                    <Badge tone="slate">Code: {product.code}</Badge>
                  ) : null}
                  {product.conditional ? (
                    <Badge tone="amber">{product.conditional}</Badge>
                  ) : (
                    <Badge tone="slate">Condition: -</Badge>
                  )}
                </div>

                {product.created_at ? (
                  <span className="font-serif text-[11px] text-emerald-100/55">
                    Added: {product.created_at.toLocaleDateString()}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* RIGHT: Details */}
          <div className="lg:col-span-5">
            <div className="relative rounded-2xl border border-emerald-900/40 bg-gradient-to-br from-slate-950 via-emerald-950/12 to-slate-950 p-5 shadow-2xl shadow-emerald-900/10">
              {/* subtle inner glow */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.08),transparent_60%)]" />

              <div className="relative">
                <h1 className="font-serif text-2xl font-bold text-emerald-100">
                  {product.name}
                </h1>

                <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-emerald-700/30 to-transparent" />

                {/* Description */}
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

                {/* Seller quick actions */}
                {(product.seller_phone || product.seller_name) && (
                  <div className="mt-5 rounded-xl border border-sky-700/30 bg-sky-950/10 p-4">
                    <p className="font-serif text-[11px] uppercase tracking-[0.2em] text-sky-200/70">
                      Seller Contact
                    </p>

                    <div className="mt-2 space-y-1 text-sm text-sky-100/80">
                      {product.seller_name ? (
                        <div className="flex justify-between gap-2">
                          <span className="opacity-70">Name</span>
                          <span className="font-semibold">
                            {product.seller_name}
                          </span>
                        </div>
                      ) : null}
                      {product.seller_phone ? (
                        <div className="flex justify-between gap-2">
                          <span className="opacity-70">Phone</span>
                          <span className="font-semibold">
                            {product.seller_phone}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {product.seller_phone ? (
                        <>
                          <a
                            href={`tel:${product.seller_phone}`}
                            className="inline-flex items-center justify-center rounded-lg border border-sky-600/40 bg-slate-950/50 px-3 py-2 font-serif text-[11px] font-semibold uppercase tracking-wide text-sky-100 hover:border-sky-400"
                          >
                            Call
                          </a>

                          {waLink ? (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center rounded-lg border border-emerald-600/40 bg-emerald-950/15 px-3 py-2 font-serif text-[11px] font-semibold uppercase tracking-wide text-emerald-100 hover:border-emerald-400"
                            >
                              WhatsApp
                            </a>
                          ) : null}

                          <button
                            type="button"
                            onClick={() =>
                              navigator.clipboard?.writeText(
                                product.seller_phone,
                              )
                            }
                            className="inline-flex items-center justify-center rounded-lg border border-amber-600/40 bg-amber-950/15 px-3 py-2 font-serif text-[11px] font-semibold uppercase tracking-wide text-amber-100 hover:border-amber-500"
                          >
                            Copy Phone
                          </button>
                        </>
                      ) : (
                        <span className="font-serif text-xs text-sky-200/60">
                          No phone provided.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* CTA */}
                <motion.button
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
                    "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 font-serif text-xs font-semibold uppercase tracking-[0.18em] transition-all",
                    "focus:outline-none focus:ring-2 focus:ring-emerald-500/50",
                    !canBuy
                      ? "cursor-not-allowed border-rose-900/30 bg-slate-950/40 text-rose-200/40"
                      : "border-emerald-500/55 bg-gradient-to-r from-emerald-950/35 via-slate-950 to-emerald-950/20 text-emerald-100 hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-900/20 active:translate-y-[1px]",
                    canBuy && ctaAnimation === "holograms" ? "hologram-btn" : "",
                    canBuy && ctaAnimation === "neonPulse" ? "neon-pulse" : "",
                  ].join(" ")}
                  {...ctaMotionProps}
                >
                  {canBuy && ctaAnimation === "holograms" ? (
                    <span className="holo-text" data-text="Add to Cart">
                      Add to Cart
                    </span>
                  ) : (
                    !canBuy ? "Out of Stock" : "Add to Cart"
                  )}
                  <span className="text-emerald-200/70">➜</span>
                  {canBuy && ctaAnimation === "holograms" ? (
                    <span className="holo-scan-line" aria-hidden="true" />
                  ) : null}
                </motion.button>

                {/* small helper */}
                <p className="mt-3 text-center font-serif text-[11px] text-emerald-100/50">
                  Tip: Please verify condition and seller details before purchase.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
