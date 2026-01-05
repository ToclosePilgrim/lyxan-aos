"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";
import { format } from "date-fns";

interface FinancialDocumentData {
  id: string;
  type: "SUPPLY_INVOICE" | "PRODUCTION_INVOICE" | "SERVICE_INVOICE" | "INVOICE" | "ACT" | "OTHER";
  status: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
  number: string;
  date: string;
  issueDate: string | null;
  dueDate: string | null;
  paidDate: string | null;
  supplierId: string | null;
  supplier: {
    id: string;
    name: string;
    code: string;
  } | null;
  totalAmount: number;
  amountPaid: number;
  currency: string;
  productionOrderId: string | null;
  productionOrder: {
    id: string;
    code: string;
    name: string;
  } | null;
  supplyId: string | null;
  supply: {
    id: string;
    code: string;
  } | null;
  services: Array<{
    id: string;
    category: string;
    name: string;
    supplier: { id: string; name: string; code: string } | null;
    totalAmount: number;
    currency: string;
    productionOrder: { id: string; code: string; name: string } | null;
    supply: { id: string; code: string } | null;
  }>;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-500",
  ISSUED: "bg-blue-500",
  PARTIALLY_PAID: "bg-yellow-500",
  PAID: "bg-green-500",
  CANCELLED: "bg-red-500",
};

const TYPE_LABELS: Record<string, string> = {
  SUPPLY_INVOICE: "Supply Invoice",
  PRODUCTION_INVOICE: "Production Invoice",
  SERVICE_INVOICE: "Service Invoice",
  INVOICE: "Invoice",
  ACT: "Act",
  OTHER: "Other",
};

export default function FinancialDocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;
  const [documentData, setDocumentData] = useState<FinancialDocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    status: "DRAFT" as string,
    issueDate: "",
    dueDate: "",
    paidDate: "",
    totalAmount: "",
    amountPaid: "",
    comment: "",
  });

  useEffect(() => {
    if (documentId) {
      loadDocument();
    }
  }, [documentId]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<FinancialDocumentData>(
        `/finance/documents/${documentId}`
      );
      setDocumentData(data);
      setFormData({
        status: data.status,
        issueDate: data.issueDate
          ? format(new Date(data.issueDate), "yyyy-MM-dd")
          : data.date
            ? format(new Date(data.date), "yyyy-MM-dd")
            : "",
        dueDate: data.dueDate
          ? format(new Date(data.dueDate), "yyyy-MM-dd")
          : "",
        paidDate: data.paidDate
          ? format(new Date(data.paidDate), "yyyy-MM-dd")
          : "",
        totalAmount: data.totalAmount.toString(),
        amountPaid: (data.amountPaid || 0).toString(),
        comment: data.comment || "",
      });
    } catch (error) {
      console.error("Failed to load financial document:", error);
      toast.error("Failed to load financial document");
      router.push("/finance/documents");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!documentData) return;

    try {
      setSaving(true);
      const payload: any = {};

      if (formData.status !== documentData.status) {
        payload.status = formData.status;
      }
      const currentIssueDate = documentData.issueDate
        ? format(new Date(documentData.issueDate), "yyyy-MM-dd")
        : documentData.date
          ? format(new Date(documentData.date), "yyyy-MM-dd")
          : "";
      if (formData.issueDate !== currentIssueDate) {
        payload.issueDate = formData.issueDate || null;
      }
      if (formData.dueDate !== (documentData.dueDate ? format(new Date(documentData.dueDate), "yyyy-MM-dd") : "")) {
        payload.dueDate = formData.dueDate || null;
      }
      if (formData.paidDate !== (documentData.paidDate ? format(new Date(documentData.paidDate), "yyyy-MM-dd") : "")) {
        payload.paidDate = formData.paidDate || null;
      }
      if (formData.totalAmount !== documentData.totalAmount.toString()) {
        payload.totalAmount = parseFloat(formData.totalAmount);
      }
      if (formData.amountPaid !== (documentData.amountPaid || 0).toString()) {
        payload.amountPaid = parseFloat(formData.amountPaid) || 0;
      }
      if (formData.comment !== (documentData.comment || "")) {
        payload.comment = formData.comment || null;
      }

      await apiRequest(`/finance/documents/${documentId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      toast.success("Financial document updated successfully");
      setIsEditing(false);
      await loadDocument();
    } catch (error: any) {
      console.error("Failed to update financial document:", error);
      toast.error("Failed to update financial document", {
        description: error.message || "Unknown error",
      });
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-8">Loading...</div>
      </MainLayout>
    );
  }

  if (!documentData) {
    return (
      <MainLayout>
        <div className="text-center py-8 text-muted-foreground">
          Financial document not found
        </div>
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
                  {saving ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>Edit</Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {TYPE_LABELS[documentData.type]}: {documentData.number}
                </CardTitle>
                <CardDescription>ID: {documentData.id}</CardDescription>
              </div>
              <Badge className={STATUS_COLORS[documentData.status] || "bg-gray-500"}>
                {documentData.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date</Label>
                  <p className="text-sm font-medium">{formatDate(documentData.date)}</p>
                </div>
                <div>
                  <Label htmlFor="issueDate">Issue Date</Label>
                  {isEditing ? (
                    <Input
                      id="issueDate"
                      type="date"
                      value={formData.issueDate}
                      onChange={(e) =>
                        setFormData({ ...formData, issueDate: e.target.value })
                      }
                      disabled={saving}
                    />
                  ) : (
                    <p className="text-sm">
                      {formatDate(documentData.issueDate || documentData.date)}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="dueDate">Due Date</Label>
                  {isEditing ? (
                    <Input
                      id="dueDate"
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) =>
                        setFormData({ ...formData, dueDate: e.target.value })
                      }
                      disabled={saving}
                    />
                  ) : (
                    <p className="text-sm">{formatDate(documentData.dueDate)}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="paidDate">Paid Date</Label>
                  {isEditing ? (
                    <Input
                      id="paidDate"
                      type="date"
                      value={formData.paidDate}
                      onChange={(e) =>
                        setFormData({ ...formData, paidDate: e.target.value })
                      }
                      disabled={saving}
                    />
                  ) : (
                    <p className="text-sm">{formatDate(documentData.paidDate)}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Supplier</Label>
                  <p className="text-sm font-medium">
                    {documentData.supplier?.name || "-"}
                  </p>
                </div>
                <div>
                  <Label htmlFor="totalAmount">Total Amount</Label>
                  {isEditing ? (
                    <Input
                      id="totalAmount"
                      type="number"
                      step="0.01"
                      value={formData.totalAmount}
                      onChange={(e) =>
                        setFormData({ ...formData, totalAmount: e.target.value })
                      }
                      disabled={saving}
                    />
                  ) : (
                    <p className="text-sm font-medium">
                      {documentData.totalAmount.toLocaleString()} {documentData.currency}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="amountPaid">Amount Paid</Label>
                  {isEditing ? (
                    <Input
                      id="amountPaid"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.amountPaid}
                      onChange={(e) =>
                        setFormData({ ...formData, amountPaid: e.target.value })
                      }
                      disabled={saving}
                    />
                  ) : (
                    <p className="text-sm font-medium">
                      {documentData.amountPaid.toLocaleString()} {documentData.currency}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                {isEditing ? (
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value })
                    }
                    disabled={saving}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">DRAFT</SelectItem>
                      <SelectItem value="ISSUED">ISSUED</SelectItem>
                      <SelectItem value="PARTIALLY_PAID">PARTIALLY_PAID</SelectItem>
                      <SelectItem value="PAID">PAID</SelectItem>
                      <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm">{documentData.status}</p>
                )}
              </div>

              <div>
                <Label>Linked To</Label>
                <div className="space-y-2">
                  {documentData.productionOrder ? (
                    <p className="text-sm">
                      Production Order:{" "}
                      <Link
                        href={`/scm/production-orders/${documentData.productionOrder.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {documentData.productionOrder.code} - {documentData.productionOrder.name}
                      </Link>
                    </p>
                  ) : null}
                  {documentData.supply ? (
                    <p className="text-sm">
                      Supply:{" "}
                      <Link
                        href={`/scm/supplies/${documentData.supply.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {documentData.supply.code}
                      </Link>
                    </p>
                  ) : null}
                  {!documentData.productionOrder && !documentData.supply && (
                    <p className="text-sm text-muted-foreground">Not linked to any order or supply</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="comment">Comment</Label>
                {isEditing ? (
                  <Textarea
                    id="comment"
                    value={formData.comment}
                    onChange={(e) =>
                      setFormData({ ...formData, comment: e.target.value })
                    }
                    rows={3}
                    disabled={saving}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{documentData.comment || "-"}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attached Services</CardTitle>
            <CardDescription>
              {documentData.services.length} service(s) attached to this document
            </CardDescription>
          </CardHeader>
          <CardContent>
            {documentData.services.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No services attached to this document.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>Linked To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentData.services.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell>{service.category}</TableCell>
                        <TableCell className="font-medium">{service.name}</TableCell>
                        <TableCell>{service.supplier?.name || "-"}</TableCell>
                        <TableCell>{service.totalAmount.toLocaleString()}</TableCell>
                        <TableCell>{service.currency}</TableCell>
                        <TableCell>
                          {service.productionOrder ? (
                            <Link
                              href={`/scm/production-orders/${service.productionOrder.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              {service.productionOrder.code}
                            </Link>
                          ) : service.supply ? (
                            <Link
                              href={`/scm/supplies/${service.supply.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              {service.supply.code}
                            </Link>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

