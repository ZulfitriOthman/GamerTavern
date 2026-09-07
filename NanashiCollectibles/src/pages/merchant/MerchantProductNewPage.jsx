import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import ProductForm from "../../components/merchant/ProductForm.jsx";
import { useSocket } from "../../services/socket/SocketContext.js";
import { useToast } from "../../components/ui/ToastContext.js";
import { createProduct } from "../../features/merchant/merchantProductSocketService.js";

export default function MerchantProductNewPage() {
  const { socket } = useSocket();
  const { push } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(fields) {
    setSubmitting(true);
    try {
      const created = await createProduct(socket, fields);
      push({ tone: "success", message: `"${created.name}" created.` });
      navigate(`/merchant/products/${created.id}`, { replace: true });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <SectionHeading eyebrow="Products" title="New product" size="section" />
      <ProductForm onSubmit={handleSubmit} submitting={submitting} submitLabel={submitting ? "Creating…" : "Create product"} />
    </div>
  );
}
