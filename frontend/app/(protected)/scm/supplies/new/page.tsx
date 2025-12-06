"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";

interface Supplier {
  id: string;
  name: string;
  code: string;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface ProductionOrder {
  id: string;
  code: string;
  name: string;
}

export default function NewSupplyPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    supplierId: "",
    warehouseId: "",
    productionOrderId: "",
    status: "DRAFT",
    currency: "RUB",
    orderDate: "",
    expectedDate: "",
    comment: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [suppliersData, warehousesResponse, ordersData] = await Promise.all([
        apiRequest<Supplier[]>("/scm/suppliers?limit=100"),
        apiRequest<{ items: Warehouse[]; total: number }>("/scm/warehouses?isActive=true&limit=100"),
        apiRequest<ProductionOrder[]>("/scm/production-orders?limit=100"),
      ]);
      setSuppliers(Array.isArray(suppliersData) ? suppliersData.filter(s => s?.id) : []);
      setWarehouses(Array.isArray(warehousesResponse?.items) ? warehousesResponse.items.filter(w => w?.id) : []);
      setProductionOrders(Array.isArray(ordersData) ? ordersData.filter(o => o?.id) : []);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load data");
      setSuppliers([]);
      setWarehouses([]);
      setProductionOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.supplierId || !formData.warehouseId || !formData.currency) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setSaving(true);
      const payload: any = {
        supplierId: formData.supplierId,
        warehouseId: formData.warehouseId,
        status: formData.status,
        currency: formData.currency,
      };

      if (formData.productionOrderId) {
        payload.productionOrderId = formData.productionOrderId;
      }
      if (formData.orderDate) {
        payload.orderDate = formData.orderDate;
      }
      if (formData.expectedDate) {
        payload.expectedDate = formData.expectedDate;
      }
      if (formData.comment) {
        payload.comment = formData.comment;
      }

      const result = await apiRequest<{ id: string }>("/scm/supplies", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success("Supply created successfully");
      router.push(`/scm/supplies/${result.id}`);
    } catch (error: any) {
      console.error("Failed to create supply:", error);
      toast.error("Failed to create supply", {
        description: error.message || "Unknown error",
      });
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
            <h1 className="text-3xl font-bold tracking-tight">Create Supply</h1>
            <p className="text-muted-foreground mt-2">Create a new supply order</p>
          </div>
          <Button variant="outline" onClick={() => router.push("/scm/supplies")}>
            Cancel
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Supply Information</CardTitle>
            <CardDescription>Fill in the supply details below</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="supplierId">Supplier *</Label>
                <Select
                  value={formData.supplierId ?? ""}
                  onValueChange={(value) =>
                    setFormData({ ...formData, supplierId: value })
                  }
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.filter(s => s?.id).map((supplier) => (
                      <SelectItem key={supplier.id} value={String(supplier.id)}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="warehouseId">Warehouse *</Label>
                <Select
                  value={formData.warehouseId ?? ""}
                  onValueChange={(value) =>
                    setFormData({ ...formData, warehouseId: value })
                  }
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.filter(w => w?.id).map((warehouse) => (
                      <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                        {warehouse.name} ({warehouse.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="productionOrderId">Production Order</Label>
                <Select
                  value={formData.productionOrderId ?? ""}
                  onValueChange={(value) =>
                    setFormData({ ...formData, productionOrderId: value })
                  }
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {productionOrders.filter(o => o?.id).map((order) => (
                      <SelectItem key={order.id} value={String(order.id)}>
                        {order.code} - {order.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
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
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="ORDERED">Ordered</SelectItem>
                    <SelectItem value="PARTIAL_RECEIVED">Partially Received</SelectItem>
                    <SelectItem value="RECEIVED">Received</SelectItem>
                    <SelectItem value="CANCELED">Canceled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="currency">Currency *</Label>
                <Input
                  id="currency"
                  value={formData.currency}
                  onChange={(e) =>
                    setFormData({ ...formData, currency: e.target.value })
                  }
                  placeholder="RUB"
                  disabled={saving}
                />
              </div>

              <div>
                <Label htmlFor="orderDate">Order Date</Label>
                <Input
                  id="orderDate"
                  type="datetime-local"
                  value={formData.orderDate}
                  onChange={(e) =>
                    setFormData({ ...formData, orderDate: e.target.value })
                  }
                  disabled={saving}
                />
              </div>

              <div>
                <Label htmlFor="expectedDate">Expected Date</Label>
                <Input
                  id="expectedDate"
                  type="datetime-local"
                  value={formData.expectedDate}
                  onChange={(e) =>
                    setFormData({ ...formData, expectedDate: e.target.value })
                  }
                  disabled={saving}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="comment">Comment</Label>
              <Textarea
                id="comment"
                value={formData.comment}
                onChange={(e) =>
                  setFormData({ ...formData, comment: e.target.value })
                }
                placeholder="Additional notes"
                rows={3}
                disabled={saving}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => router.push("/scm/supplies")}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                Create Supply
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

