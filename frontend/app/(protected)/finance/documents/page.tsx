"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  servicesCount?: number;
  createdAt: string;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  INVOICE: "Invoice",
  BILL: "Bill",
  ACT: "Act",
  CREDIT_NOTE: "Credit Note",
  OTHER: "Other",
  SUPPLY_INVOICE: "Supply Invoice (legacy)",
  PRODUCTION_INVOICE: "Production Invoice (legacy)",
  SERVICE_INVOICE: "Service Invoice (legacy)",
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

export default function FinancialDocumentsPage() {
  const [documents, setDocuments] = useState<FinancialDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [filters, setFilters] = useState({
    search: "",
    type: "",
    direction: "",
    status: "",
    supplierId: "",
    limit: 20,
    offset: 0,
  });

  useEffect(() => {
    loadDocuments();
  }, [filters]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.search) params.append("search", filters.search);
      if (filters.type) params.append("type", filters.type);
      if (filters.direction) params.append("direction", filters.direction);
      if (filters.status) params.append("status", filters.status);
      if (filters.supplierId) params.append("supplierId", filters.supplierId);
      params.append("limit", filters.limit.toString());
      params.append("offset", filters.offset.toString());

      const query = params.toString();
      const endpoint = `/finance/documents${query ? `?${query}` : ""}`;
      const { items, total } = await apiRequest<{ items: FinancialDocument[]; total: number }>(endpoint);
      setDocuments(Array.isArray(items) ? items : []);
      setTotal(total || 0);
    } catch (error) {
      console.error("Failed to load financial documents:", error);
      toast.error("Failed to load financial documents");
      setDocuments([]);
      setTotal(0);
    } finally {
      setLoading(false);
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

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Financial Documents</h1>
            <p className="text-muted-foreground mt-2">
              Manage invoices, bills, acts, and other financial documents
            </p>
          </div>
          <Link href="/finance/documents/new">
            <Button>Create Document</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Document List</CardTitle>
            <CardDescription>View and manage your financial documents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <Input
                placeholder="Search by number or external ID..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, offset: 0 })}
                className="max-w-sm"
              />
              <Select
                value={filters.type}
                onValueChange={(value) => setFilters({ ...filters, type: value, offset: 0 })}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="INVOICE">Invoice</SelectItem>
                  <SelectItem value="BILL">Bill</SelectItem>
                  <SelectItem value="ACT">Act</SelectItem>
                  <SelectItem value="CREDIT_NOTE">Credit Note</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.direction}
                onValueChange={(value) => setFilters({ ...filters, direction: value, offset: 0 })}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Directions</SelectItem>
                  <SelectItem value="INCOMING">Incoming</SelectItem>
                  <SelectItem value="OUTGOING">Outgoing</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({ ...filters, status: value, offset: 0 })}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="text-center py-8">Loading documents...</div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No financial documents found.
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Document №</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Counterparty</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Linked to</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>{formatDate(doc.docDate ?? null)}</TableCell>
                        <TableCell className="font-medium">{doc.docNumber ?? "-"}</TableCell>
                        <TableCell>{DOCUMENT_TYPE_LABELS[doc.type ?? "OTHER"] ?? doc.type ?? "-"}</TableCell>
                        <TableCell>{DOCUMENT_DIRECTION_LABELS[doc.direction ?? ""] ?? doc.direction ?? "-"}</TableCell>
                        <TableCell>
                          <Badge className={DOCUMENT_STATUS_COLORS[doc.status ?? "DRAFT"] ?? "bg-gray-500"}>
                            {doc.status ?? "DRAFT"}
                          </Badge>
                        </TableCell>
                        <TableCell>{doc.supplier?.name ?? "-"}</TableCell>
                        <TableCell>{formatAmount(doc.totalAmount ?? doc.amountTotal ?? null, doc.currency ?? null)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {doc.productionOrder && (
                            <div>PO: {doc.productionOrder.code ?? "-"}</div>
                          )}
                          {doc.scmSupply && (
                            <div>Supply: {doc.scmSupply.code ?? "-"}</div>
                          )}
                          {(doc.servicesCount ?? 0) > 0 && (
                            <div>{doc.servicesCount} service(s)</div>
                          )}
                          {!doc.productionOrder && !doc.scmSupply && (doc.servicesCount ?? 0) === 0 && "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/finance/documents/${doc.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {filters.offset + 1} to {Math.min(filters.offset + filters.limit, total)} of {total} documents
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilters({ ...filters, offset: Math.max(0, filters.offset - filters.limit) })}
                      disabled={filters.offset === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilters({ ...filters, offset: filters.offset + filters.limit })}
                      disabled={filters.offset + filters.limit >= total}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
