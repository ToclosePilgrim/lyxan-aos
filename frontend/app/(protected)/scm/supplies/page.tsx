"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";
import { format } from "date-fns";

interface Supply {
  id: string;
  code: string;
  status: "DRAFT" | "ORDERED" | "PARTIAL_RECEIVED" | "RECEIVED" | "CANCELED";
  supplierId: string;
  supplier: {
    id: string;
    name: string;
    code: string;
  };
  warehouseId: string;
  warehouse: {
    id: string;
    name: string;
    code: string;
    type: string;
  };
  productionOrderId: string | null;
  productionOrder: {
    id: string;
    code: string;
    name: string;
  } | null;
  currency: string;
  totalAmount: number;
  orderDate: string | null;
  expectedDate: string | null;
  receivedDate: string | null;
  comment: string | null;
  itemsCount: number;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-500",
  ORDERED: "bg-blue-500",
  PARTIAL_RECEIVED: "bg-orange-500",
  RECEIVED: "bg-green-500",
  CANCELED: "bg-red-500",
};

export default function SuppliesPage() {
  const router = useRouter();
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  useEffect(() => {
    loadSupplies();
  }, [statusFilter]);

  const loadSupplies = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") {
        params.append("status", statusFilter);
      }
      const queryString = params.toString();
      const url = `/scm/supplies${queryString ? `?${queryString}` : ""}`;
      const data = await apiRequest<Supply[]>(url);
      setSupplies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load supplies:", error);
      toast.error("Failed to load supplies");
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

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Supplies</h1>
            <p className="text-muted-foreground mt-2">
              Manage supplies and track deliveries
            </p>
          </div>
          <Button asChild>
            <Link href="/scm/supplies/new">Create Supply</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Supplies</CardTitle>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="ORDERED">Ordered</SelectItem>
                    <SelectItem value="PARTIAL_RECEIVED">Partially Received</SelectItem>
                    <SelectItem value="RECEIVED">Received</SelectItem>
                    <SelectItem value="CANCELED">Canceled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : supplies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No supplies found. Click "Create Supply" to create one.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Expected Date</TableHead>
                    <TableHead>Received Date</TableHead>
                    <TableHead>Production Order</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplies.map((supply) => (
                    <TableRow key={supply.id}>
                      <TableCell className="font-medium">{supply.code}</TableCell>
                      <TableCell>{supply.supplier.name}</TableCell>
                      <TableCell>{supply.warehouse.name}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[supply.status] || "bg-gray-500"}>
                          {supply.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{supply.currency}</TableCell>
                      <TableCell>{formatDate(supply.orderDate)}</TableCell>
                      <TableCell>{formatDate(supply.expectedDate)}</TableCell>
                      <TableCell>{formatDate(supply.receivedDate)}</TableCell>
                      <TableCell>
                        {supply.productionOrder ? (
                          <Link
                            href={`/scm/production-orders/${supply.productionOrder.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {supply.productionOrder.code}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/scm/supplies/${supply.id}`}>
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
