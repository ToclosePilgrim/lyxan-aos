"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";
import { format } from "date-fns";

interface FinancialDocument {
  id: string;
  docNumber: string | null;
  docDate: string | null;
  type: string | null;
  direction: string | null;
  status: string | null;
  totalAmount?: number;
  amountTotal?: number;
  amountPaid?: number;
  currency: string | null;
  dueDate: string | null;
  supplier: {
    id: string;
    name: string;
    code: string;
  } | null;
  productionOrder: {
    id: string;
    code: string;
    name: string;
  } | null;
  scmSupply: {
    id: string;
    code: string;
  } | null;
  externalId: string | null;
  fileUrl: string | null;
  notes: string | null;
  services?: Array<{
    id: string;
    category: string;
    name: string;
    supplier: {
      id: string;
      name: string;
      code: string;
    } | null;
    totalAmount: number;
    currency: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface Supplier {
  id: string;
  name: string;
  code: string;
}

interface ProductionOrder {
  id: string;
  code: string;
  name: string;
}

interface ScmSupply {
  id: string;
  code: string;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  INVOICE: "Invoice",
  BILL: "Bill",
  ACT: "Act",
  CREDIT_NOTE: "Credit Note",
  OTHER: "Other",
};

const DOCUMENT_DIRECTION_LABELS: Record<string, string> = {
  INCOMING: "Incoming",
  OUTGOING: "Outgoing",
};

const DOCUMENT_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-500",
  SENT: "bg-blue-500",
  ISSUED: "bg-blue-500",
  PARTIALLY_PAID: "bg-yellow-500",
  PAID: "bg-green-500",
  CANCELLED: "bg-red-500",
};

const DOCUMENT_STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "PARTIALLY_PAID", label: "Partially Paid" },
  { value: "PAID", label: "Paid" },
  { value: "CANCELLED", label: "Cancelled" },
];

const CURRENCIES = ["RUB", "USD", "EUR", "CNY"];

export default function FinancialDocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;

  const [document, setDocument] = useState<FinancialDocument | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [supplies, setSupplies] = useState<ScmSupply[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    docNumber: "",
    docDate: "",
    type: "INVOICE",
    direction: "INCOMING",
    status: "DRAFT",
    currency: "RUB",
    amountTotal: "",
    amountPaid: "",
    dueDate: "",
    supplierId: "",
    productionOrderId: "",
    scmSupplyId: "",
    externalId: "",
    fileUrl: "",
    notes: "",
  });

  useEffect(() => {
    if (documentId) {
      loadDocument();
      Promise.all([loadSuppliers(), loadProductionOrders(), loadSupplies()]);
    }
  }, [documentId]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<FinancialDocument>(`/finance/documents/${documentId}`);
      setDocument(data);
      setFormData({
        docNumber: data.docNumber || "",
        docDate: data.docDate ? format(new Date(data.docDate), "yyyy-MM-dd") : "",
        type: data.type || "INVOICE",
        direction: data.direction || "INCOMING",
        status: data.status || "DRAFT",
        currency: data.currency || "RUB",
        amountTotal: (data.totalAmount ?? data.amountTotal ?? 0).toString(),
        amountPaid: (data.amountPaid ?? 0).toString(),
        dueDate: data.dueDate ? format(new Date(data.dueDate), "yyyy-MM-dd") : "",
        supplierId: data.supplier?.id || "",
        productionOrderId: data.productionOrder?.id || "",
        scmSupplyId: data.scmSupply?.id || "",
        externalId: data.externalId || "",
        fileUrl: data.fileUrl || "",
        notes: data.notes || "",
      });
    } catch (error) {
      console.error("Failed to load financial document:", error);
      toast.error("Failed to load financial document");
      router.push("/finance/documents");
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliers = async () => {
    try {
      const data = await apiRequest<Supplier[]>("/scm/suppliers?status=ACTIVE&limit=100");
      setSuppliers(Array.isArray(data) ? data.filter(s => s?.id) : []);
    } catch (error) {
      console.error("Failed to load suppliers:", error);
      setSuppliers([]);
    }
  };

  const loadProductionOrders = async () => {
    try {
      const data = await apiRequest<ProductionOrder[]>("/scm/production-orders");
      setProductionOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load production orders:", error);
    }
  };

  const loadSupplies = async () => {
    try {
      const data = await apiRequest<ScmSupply[]>("/scm/supplies");
      setSupplies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load supplies:", error);
    }
  };

  const handleSave = async () => {
    if (!document) return;

    try {
      setSaving(true);
      const payload: any = {};

      if (formData.docNumber !== document.docNumber) payload.docNumber = formData.docNumber;
      if (formData.docDate !== (document.docDate ? format(new Date(document.docDate), "yyyy-MM-dd") : "")) {
        payload.docDate = formData.docDate ? new Date(formData.docDate).toISOString() : null;
      }
      if (formData.type !== document.type) payload.type = formData.type;
      if (formData.direction !== document.direction) payload.direction = formData.direction;
      if (formData.status !== document.status) payload.status = formData.status;
      if (formData.currency !== document.currency) payload.currency = formData.currency;
      if (formData.amountTotal !== document.totalAmount?.toString()) {
        payload.amountTotal = formData.amountTotal ? parseFloat(formData.amountTotal) : 0;
      }
      if (formData.amountPaid !== document.amountPaid?.toString()) {
        payload.amountPaid = formData.amountPaid ? parseFloat(formData.amountPaid) : 0;
      }
      if (formData.dueDate !== (document.dueDate ? format(new Date(document.dueDate), "yyyy-MM-dd") : "")) {
        payload.dueDate = formData.dueDate ? new Date(formData.dueDate).toISOString() : null;
      }
      if (formData.supplierId !== (document.supplier?.id || "")) {
        payload.supplierId = formData.supplierId || null;
      }
      if (formData.productionOrderId !== (document.productionOrder?.id || "")) {
        payload.productionOrderId = formData.productionOrderId || null;
      }
      if (formData.scmSupplyId !== (document.scmSupply?.id || "")) {
        payload.scmSupplyId = formData.scmSupplyId || null;
      }
      if (formData.externalId !== document.externalId) payload.externalId = formData.externalId;
      if (formData.fileUrl !== document.fileUrl) payload.fileUrl = formData.fileUrl;
      if (formData.notes !== document.notes) payload.notes = formData.notes;

      await apiRequest(`/finance/documents/${documentId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      toast.success("Financial document updated successfully");
      setIsEditing(false);
      await loadDocument();
    } catch (error: any) {
      console.error("Failed to update financial document:", error);
      toast.error(error.message || "Failed to update financial document");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await apiRequest(`/finance/documents/${documentId}`, {
        method: "DELETE",
      });
      toast.success("Financial document deleted successfully");
      router.push("/finance/documents");
    } catch (error: any) {
      console.error("Failed to delete financial document:", error);
      toast.error(error.message || "Failed to delete financial document");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd.MM.yyyy");
    } catch {
      return dateString;
    }
  };

  const formatAmount = (amount: number | null | undefined, currency: string | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) return "-";
    return `${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || ""}`;
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-8">Loading...</div>
      </MainLayout>
    );
  }

  if (!document) {
    return (
      <MainLayout>
        <div className="text-center py-8 text-muted-foreground">Document not found.</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="outline" asChild>
              <Link href="/finance/documents">← Back to list</Link>
            </Button>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="destructive">Delete</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete Financial Document</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to delete this financial document? This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline">Cancel</Button>
                      <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                        {deleting ? "Deleting..." : "Delete"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Financial Document: {document.docNumber || "N/A"}</CardTitle>
              <Badge className={DOCUMENT_STATUS_COLORS[document.status || "DRAFT"]}>
                {document.status || "DRAFT"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Document Type</Label>
                  {isEditing ? (
                    <Select
                      value={formData.type}
                      onValueChange={(value) => setFormData({ ...formData, type: value })}
                      disabled={saving}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INVOICE">Invoice</SelectItem>
                        <SelectItem value="BILL">Bill</SelectItem>
                        <SelectItem value="ACT">Act</SelectItem>
                        <SelectItem value="CREDIT_NOTE">Credit Note</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm">{DOCUMENT_TYPE_LABELS[document.type || "OTHER"] || document.type || "-"}</p>
                  )}
                </div>
                <div>
                  <Label>Direction</Label>
                  {isEditing ? (
                    <Select
                      value={formData.direction}
                      onValueChange={(value) => setFormData({ ...formData, direction: value })}
                      disabled={saving}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INCOMING">Incoming</SelectItem>
                        <SelectItem value="OUTGOING">Outgoing</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm">{DOCUMENT_DIRECTION_LABELS[document.direction || ""] || document.direction || "-"}</p>
                  )}
                </div>
                <div>
                  <Label>Status</Label>
                  {isEditing ? (
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                      disabled={saving}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_STATUSES.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm">{document.status || "-"}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Document Number</Label>
                  {isEditing ? (
                    <Input
                      value={formData.docNumber}
                      onChange={(e) => setFormData({ ...formData, docNumber: e.target.value })}
                      disabled={saving}
                    />
                  ) : (
                    <p className="text-sm">{document.docNumber || "-"}</p>
                  )}
                </div>
                <div>
                  <Label>Document Date</Label>
                  {isEditing ? (
                    <Input
                      type="date"
                      value={formData.docDate}
                      onChange={(e) => setFormData({ ...formData, docDate: e.target.value })}
                      disabled={saving}
                    />
                  ) : (
                    <p className="text-sm">{formatDate(document.docDate)}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Amounts</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Currency</Label>
                  {isEditing ? (
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => setFormData({ ...formData, currency: value })}
                      disabled={saving}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((currency) => (
                          <SelectItem key={currency} value={currency}>
                            {currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm">{document.currency || "-"}</p>
                  )}
                </div>
                <div>
                  <Label>Total Amount</Label>
                  {isEditing ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amountTotal}
                      onChange={(e) => setFormData({ ...formData, amountTotal: e.target.value })}
                      disabled={saving}
                    />
                  ) : (
                    <p className="text-sm">{formatAmount(document.totalAmount ?? document.amountTotal ?? null, document.currency ?? null)}</p>
                  )}
                </div>
                <div>
                  <Label>Paid Amount</Label>
                  {isEditing ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amountPaid}
                      onChange={(e) => setFormData({ ...formData, amountPaid: e.target.value })}
                      disabled={saving}
                    />
                  ) : (
                    <p className="text-sm">{formatAmount(document.amountPaid ?? null, document.currency ?? null)}</p>
                  )}
                </div>
              </div>
              <div>
                <Label>Due Date</Label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    disabled={saving}
                  />
                ) : (
                  <p className="text-sm">{formatDate(document.dueDate)}</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Links</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Supplier</Label>
                  {isEditing ? (
                    <Select
                      value={formData.supplierId ?? ""}
                      onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
                      disabled={saving}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {suppliers.filter(s => s?.id).map((supplier) => (
                          <SelectItem key={supplier.id} value={String(supplier.id)}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm">{document.supplier?.name || "-"}</p>
                  )}
                </div>
                <div>
                  <Label>Production Order</Label>
                  {isEditing ? (
                    <Select
                      value={formData.productionOrderId ?? ""}
                      onValueChange={(value) => setFormData({ ...formData, productionOrderId: value })}
                      disabled={saving}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select production order" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {productionOrders.filter(o => o?.id).map((order) => (
                          <SelectItem key={order.id} value={String(order.id)}>
                            {order.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm">
                      {document.productionOrder ? (
                        <Link href={`/scm/production-orders/${document.productionOrder.id}`} className="text-blue-600 hover:underline">
                          {document.productionOrder.code}
                        </Link>
                      ) : "-"}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Supply</Label>
                  {isEditing ? (
                    <Select
                      value={formData.scmSupplyId ?? ""}
                      onValueChange={(value) => setFormData({ ...formData, scmSupplyId: value })}
                      disabled={saving}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select supply" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {supplies.filter(s => s?.id).map((supply) => (
                          <SelectItem key={supply.id} value={String(supply.id)}>
                            {supply.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm">
                      {document.scmSupply ? (
                        <Link href={`/scm/supplies/${document.scmSupply.id}`} className="text-blue-600 hover:underline">
                          {document.scmSupply.code}
                        </Link>
                      ) : "-"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Other</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>External ID</Label>
                  {isEditing ? (
                    <Input
                      value={formData.externalId}
                      onChange={(e) => setFormData({ ...formData, externalId: e.target.value })}
                      disabled={saving}
                    />
                  ) : (
                    <p className="text-sm">{document.externalId || "-"}</p>
                  )}
                </div>
                <div>
                  <Label>File URL</Label>
                  {isEditing ? (
                    <Input
                      value={formData.fileUrl}
                      onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
                      disabled={saving}
                    />
                  ) : (
                    <p className="text-sm">
                      {document.fileUrl ? (
                        <a href={document.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          View file
                        </a>
                      ) : "-"}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                {isEditing ? (
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    disabled={saving}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{document.notes || "-"}</p>
                )}
              </div>
            </div>

            {document.services && document.services.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Linked Services ({document.services.length})</h3>
                <div className="border rounded-md p-4 space-y-2">
                  {document.services.map((service) => (
                    <div key={service.id} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{service.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {service.supplier?.name || "N/A"} • {service.category}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatAmount(service.totalAmount ?? null, service.currency ?? null)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t pt-4 text-sm text-muted-foreground">
              <p>Created: {formatDate(document.createdAt)}</p>
              <p>Updated: {formatDate(document.updatedAt)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
