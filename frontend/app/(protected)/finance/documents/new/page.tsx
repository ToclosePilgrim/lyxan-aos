"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";

interface Supplier {
  id: string;
  name: string;
  code: string;
  status: string;
}

interface ProductionOrder {
  id: string;
  code: string;
  name: string;
  status: string;
}

interface ScmSupply {
  id: string;
  code: string;
  status: string;
}

const DOCUMENT_TYPES = [
  { value: "INVOICE", label: "Invoice" },
  { value: "BILL", label: "Bill" },
  { value: "ACT", label: "Act" },
  { value: "CREDIT_NOTE", label: "Credit Note" },
  { value: "OTHER", label: "Other" },
];

const DOCUMENT_DIRECTIONS = [
  { value: "INCOMING", label: "Incoming (from supplier)" },
  { value: "OUTGOING", label: "Outgoing (to customer)" },
];

const DOCUMENT_STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "PARTIALLY_PAID", label: "Partially Paid" },
  { value: "PAID", label: "Paid" },
  { value: "CANCELLED", label: "Cancelled" },
];

const CURRENCIES = ["RUB", "USD", "EUR", "CNY"];

export default function NewFinancialDocumentPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [supplies, setSupplies] = useState<ScmSupply[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    Promise.all([loadSuppliers(), loadProductionOrders(), loadSupplies()]).finally(() => setLoading(false));
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      const payload: any = {};

      if (formData.docNumber) payload.docNumber = formData.docNumber;
      if (formData.docDate) payload.docDate = new Date(formData.docDate).toISOString();
      if (formData.type) payload.type = formData.type;
      if (formData.direction) payload.direction = formData.direction;
      if (formData.status) payload.status = formData.status;
      if (formData.currency) payload.currency = formData.currency;
      if (formData.amountTotal) payload.amountTotal = parseFloat(formData.amountTotal);
      if (formData.amountPaid) payload.amountPaid = parseFloat(formData.amountPaid);
      if (formData.dueDate) payload.dueDate = new Date(formData.dueDate).toISOString();
      if (formData.supplierId) payload.supplierId = formData.supplierId;
      if (formData.productionOrderId) payload.productionOrderId = formData.productionOrderId;
      if (formData.scmSupplyId) payload.scmSupplyId = formData.scmSupplyId;
      if (formData.externalId) payload.externalId = formData.externalId;
      if (formData.fileUrl) payload.fileUrl = formData.fileUrl;
      if (formData.notes) payload.notes = formData.notes;

      await apiRequest("/finance/documents", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success("Financial document created successfully");
      router.push("/finance/documents");
    } catch (error: any) {
      console.error("Failed to create financial document:", error);
      toast.error(error.message || "Failed to create financial document");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-8">Loading...</div>
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
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Financial Document</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Document Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="direction">Direction</Label>
                    <Select
                      value={formData.direction}
                      onValueChange={(value) => setFormData({ ...formData, direction: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_DIRECTIONS.map((dir) => (
                          <SelectItem key={dir.value} value={dir.value}>
                            {dir.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
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
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="docNumber">Document Number</Label>
                    <Input
                      id="docNumber"
                      value={formData.docNumber}
                      onChange={(e) => setFormData({ ...formData, docNumber: e.target.value })}
                      placeholder="INV-2025-0001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="docDate">Document Date</Label>
                    <Input
                      id="docDate"
                      type="date"
                      value={formData.docDate}
                      onChange={(e) => setFormData({ ...formData, docDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Amounts</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => setFormData({ ...formData, currency: value })}
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
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amountTotal">Total Amount</Label>
                    <Input
                      id="amountTotal"
                      type="number"
                      step="0.01"
                      value={formData.amountTotal}
                      onChange={(e) => setFormData({ ...formData, amountTotal: e.target.value })}
                      placeholder="50000.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amountPaid">Paid Amount</Label>
                    <Input
                      id="amountPaid"
                      type="number"
                      step="0.01"
                      value={formData.amountPaid}
                      onChange={(e) => setFormData({ ...formData, amountPaid: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Links</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="supplierId">Supplier</Label>
                    <Select
                      value={formData.supplierId ?? ""}
                      onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
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
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="productionOrderId">Production Order</Label>
                    <Select
                      value={formData.productionOrderId ?? ""}
                      onValueChange={(value) => setFormData({ ...formData, productionOrderId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select production order" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {productionOrders.filter(o => o?.id).map((order) => (
                          <SelectItem key={order.id} value={String(order.id)}>
                            {order.code} — {order.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scmSupplyId">Supply</Label>
                    <Select
                      value={formData.scmSupplyId ?? ""}
                      onValueChange={(value) => setFormData({ ...formData, scmSupplyId: value })}
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
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Other</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="externalId">External ID</Label>
                    <Input
                      id="externalId"
                      value={formData.externalId}
                      onChange={(e) => setFormData({ ...formData, externalId: e.target.value })}
                      placeholder="External system ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fileUrl">File URL</Label>
                    <Input
                      id="fileUrl"
                      value={formData.fileUrl}
                      onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <Link href="/finance/documents">Cancel</Link>
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Creating..." : "Create Document"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

