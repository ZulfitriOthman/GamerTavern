import { useState } from "react";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Button from "../../components/ui/Button.jsx";
import Modal from "../../components/ui/Modal.jsx";
import { TextField, SelectField } from "../../components/ui/Field.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import RoleGate from "../../components/merchant/RoleGate.jsx";
import { useMerchantAuth } from "../../features/merchant/MerchantAuthContext.js";
import { useApiResource } from "../../features/merchant/useApiResource.js";
import * as merchantApi from "../../features/merchant/merchantApi.js";
import { useToast } from "../../components/ui/ToastContext.js";
import { formatDate } from "../../features/merchant/format.js";

function AddStaffModal({ open, onClose, onAdded }) {
  const { token, activeMerchant } = useMerchantAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MERCHANT_EMPLOYEE");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Enter the staff member's email.");
      return;
    }
    setSubmitting(true);
    try {
      await merchantApi.addStaff(token, { email: email.trim(), role }, { merchantId: activeMerchant?.merchantId });
      onAdded();
      setEmail("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add staff member">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <p className="text-xs text-amber-50/45">They must already have a NanashiCollectibles account with this email.</p>
        <TextField id="staff-email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <SelectField id="staff-role" label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="MERCHANT_EMPLOYEE">Employee — products, inventory, orders</option>
          <option value="MERCHANT_ADMIN">Admin — also staff list, settings, payouts</option>
        </SelectField>
        {error ? (
          <p role="alert" className="text-sm text-danger-400">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={submitting}>
            Add
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function StaffList() {
  const { token, activeMerchant, role } = useMerchantAuth();
  const { push } = useToast();
  const [modalOpen, setModalOpen] = useState(false);

  const { status, data, error, refresh } = useApiResource(
    () => merchantApi.getStaff(token, { merchantId: activeMerchant?.merchantId }),
    [token, activeMerchant?.merchantId]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading eyebrow="Team" title="Staff" size="section" />
        {role === "MERCHANT_OWNER" ? <Button onClick={() => setModalOpen(true)}>Add staff</Button> : null}
      </div>

      <DataTable
        status={status}
        error={error}
        rows={data?.data || []}
        emptyTitle="No staff added yet"
        emptyDescription="Add teammates so they can help manage this store."
        onRetry={refresh}
        columns={[
          { key: "name", header: "Name", render: (r) => r.name },
          { key: "email", header: "Email", render: (r) => r.email },
          { key: "role", header: "Role", render: (r) => r.role.replace("MERCHANT_", "") },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={String(r.status).toUpperCase()} /> },
          { key: "created_at", header: "Joined", render: (r) => formatDate(r.created_at), mobileHidden: true },
        ]}
      />

      <AddStaffModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdded={() => {
          setModalOpen(false);
          push({ tone: "success", message: "Staff member added." });
          refresh();
        }}
      />
    </div>
  );
}

export default function MerchantStaffPage() {
  return (
    <RoleGate allow={["MERCHANT_OWNER", "MERCHANT_ADMIN"]}>
      <StaffList />
    </RoleGate>
  );
}
