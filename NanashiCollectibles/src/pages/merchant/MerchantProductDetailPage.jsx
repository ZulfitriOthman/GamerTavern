import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import Modal from "../../components/ui/Modal.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import { useSocket } from "../../services/socket/SocketContext.js";
import { useToast } from "../../components/ui/ToastContext.js";
import { useMerchantProduct } from "../../features/merchant/useMerchantProduct.js";
import { archiveProduct } from "../../features/merchant/merchantProductSocketService.js";
import { formatMoney, formatDateTime } from "../../features/merchant/format.js";

export default function MerchantProductDetailPage() {
  const { id } = useParams();
  const { status, product, error } = useMerchantProduct(id);
  const { socket } = useSocket();
  const { push } = useToast();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  async function handleArchive() {
    setArchiving(true);
    try {
      await archiveProduct(socket, Number(id));
      push({ tone: "success", message: "Product archived." });
      setConfirmOpen(false);
      navigate("/merchant/products");
    } catch (err) {
      push({ tone: "error", message: err.message });
    } finally {
      setArchiving(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="max-w-3xl">
        <SkeletonText lines={6} />
      </div>
    );
  }
  if (status === "not_found") {
    return <EmptyState title="Product not found" description="It may have been deleted, or you don't have access to it." />;
  }
  if (status === "error") {
    return <EmptyState title="Couldn't load this product" description={error} />;
  }

  const primaryImage = product.images?.find((img) => img.is_primary) || product.images?.[0];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeading eyebrow="Products" title={product.name} size="section" />
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" to={`/merchant/products/${id}/edit`}>
            Edit
          </Button>
          {product.status !== "archived" ? (
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              Archive
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="aspect-square w-full shrink-0 overflow-hidden rounded-lg border border-white/10 bg-ink-900 sm:w-40">
            {primaryImage ? (
              <img src={primaryImage.image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-amber-50/30">No image</div>
            )}
          </div>

          <div className="flex-1 space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={product.status} />
              {product.featured ? <span className="text-xs text-gold-300">★ Featured</span> : null}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-50/40">SKU</dt>
                <dd className="text-amber-50/85">{product.code || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-50/40">Price</dt>
                <dd className="text-amber-50/85">{formatMoney(product.price)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-50/40">Stock</dt>
                <dd className="text-amber-50/85">{product.stock_quantity}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-50/40">Brand</dt>
                <dd className="text-amber-50/85">{product.brand || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-50/40">Category</dt>
                <dd className="text-amber-50/85">{product.category_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-50/40">Updated</dt>
                <dd className="text-amber-50/85">{formatDateTime(product.updated_at)}</dd>
              </div>
            </dl>
            {product.description ? <p className="pt-2 text-amber-50/70">{product.description}</p> : null}
          </div>
        </div>
      </Card>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Archive this product?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleArchive} isLoading={archiving}>
              Archive
            </Button>
          </>
        }
      >
        <p className="text-sm text-amber-50/65">
          Archived products are hidden from the storefront. You can bring it back later by editing it and setting
          its status to Active.
        </p>
      </Modal>
    </div>
  );
}
