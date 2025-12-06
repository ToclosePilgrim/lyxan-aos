"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface ProductionOrder {
  id: string;
  code: string;
  name: string;
  productId: string;
  productName: string;
  status: "DRAFT" | "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  quantityPlanned: number;
  unit: string;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-500",
  PLANNED: "bg-blue-500",
  IN_PROGRESS: "bg-yellow-500",
  COMPLETED: "bg-green-500",
  CANCELLED: "bg-red-500",
};

export default function ProductionOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    loadOrders();
  }, [statusFilter, search]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") {
        params.append("status", statusFilter);
      }
      if (search) {
        params.append("search", search);
      }
      const queryString = params.toString();
      const url = `/scm/production-orders${queryString ? `?${queryString}` : ""}`;
      const data = await apiRequest<ProductionOrder[]>(url);
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load production orders:", error);
      toast.error("Failed to load production orders");
      setOrders([]);
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
            <h1 className="text-3xl font-bold tracking-tight">Production Orders</h1>
            <p className="text-muted-foreground mt-2">
              Manage production orders and track manufacturing batches
            </p>
          </div>
          <Button asChild>
            <Link href="/scm/production-orders/new">Create Order</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              <Input
                placeholder="Search by code or name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadOrders()}
                className="flex-1 min-w-[200px]"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PLANNED">Planned</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={loadOrders}>Search</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Production Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No production orders found. Click "Create Order" to create one.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Planned Start</TableHead>
                    <TableHead>Planned End</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.code}</TableCell>
                      <TableCell>{order.name}</TableCell>
                      <TableCell>
                        <Link
                          href={`/scm/products/${order.productId}`}
                          className="text-blue-600 hover:underline"
                        >
                          {order.productName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {order.quantityPlanned} {order.unit}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[order.status] || "bg-gray-500"}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(order.plannedStartAt)}</TableCell>
                      <TableCell>{formatDate(order.plannedEndAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/scm/production-orders/${order.id}`}>
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

