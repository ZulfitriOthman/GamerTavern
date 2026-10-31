import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Button from "../../components/ui/Button.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import ProductForm from "../../components/merchant/ProductForm.jsx";
import { useSocket } from "../../services/socket/SocketContext.js";
import { useToast } from "../../components/ui/ToastContext.js";
import { useMerchantProduct } from "../../features/merchant/useMerchantProduct.js";
import { updateProduct } from "../../features/merchant/merchantProductSocketService.js";

export default function MerchantProductEditPage() {
  const { id } = useParams();
  const { status, product, error, refresh } = useMerchantProduct(id);
  const { socket } = useSocket();
  const { push } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(fields) {
    setSubmitting(true);
    try {
      const updated = await updateProduct(socket, { id: Number(id), ...fields });
      push({ tone: "success", message: `"${updated.name}" updated.` });
      navigate(`/merchant/products/${id}`, { replace: true });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <SectionHeading eyebrow="Products" title="Edit product" size="section" />

      {status === "loading" ? (
        <SkeletonText lines={4} />
      ) : status === "not_found" ? (
        <EmptyState title="Product not found" description="It may have been deleted, or you don't have access to it." />
      ) : status === "error" ? (
        <EmptyState
          title="Couldn't load this product"
          description={error}
          action={
            <Button variant="secondary" size="sm" onClick={refresh}>
              Try again
            </Button>
          }
        />
      ) : (
        <ProductForm product={product} onSubmit={handleSubmit} submitting={submitting} submitLabel={submitting ? "Saving…" : "Save changes"} />
      )}
    </div>
  );
}
