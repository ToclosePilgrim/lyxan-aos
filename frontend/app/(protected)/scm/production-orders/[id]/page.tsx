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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";
import { format } from "date-fns";

interface FinancialDocument {
  id: string;
  type: string;
  status: string;
  number: string;
  date: string;
  issueDate: string | null;
  dueDate: string | null;
  paidDate: string | null;
  totalAmount: number;
  amountPaid: number;
  currency: string;
  supplier: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface ProductionOrderData {
  order: {
    id: string;
    code: string;
    name: string;
    status: "DRAFT" | "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    productId: string;
    productName: string;
    quantityPlanned: number;
    unit: string;
    plannedStartAt: string | null;
    plannedEndAt: string | null;
    actualStartAt: string | null;
    actualEndAt: string | null;
    productionSite: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  };
  items: Array<{
    id: string;
    supplierItemId: string;
    status: string;
    quantityPlanned: number;
    quantityUnit: string;
    quantityReceived: number | null;
    expectedDate: string | null;
    receivedDate: string | null;
    fromBom: boolean;
    note: string | null;
    supplierItem: {
      id: string;
      name: string;
      code: string;
      type: "MATERIAL" | "SERVICE";
      category: string;
      unit: string;
      supplier: {
        id: string;
        name: string;
        code: string;
      };
    };
  }>;
  serviceOperations?: Array<{
    id: string;
    category: string;
    name: string;
    supplier: {
      id: string;
      name: string;
      code: string;
    };
    totalAmount: number;
    currency: string;
  }>;
  financialDocuments?: FinancialDocument[];
}

interface Supplier {
  id: string;
  name: string;
  code: string;
}

interface SupplierItem {
  id: string;
  name: string;
  code: string;
  type: "MATERIAL" | "SERVICE";
  category: string;
  unit: string;
  supplier: {
    id: string;
    name: string;
  };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-500",
  PLANNED: "bg-blue-500",
  IN_PROGRESS: "bg-yellow-500",
  COMPLETED: "bg-green-500",
  CANCELLED: "bg-red-500",
};

const ITEM_STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-gray-500",
  ORDERED: "bg-blue-500",
  PARTIALLY_RECEIVED: "bg-yellow-500",
  RECEIVED: "bg-green-500",
  USED_IN_PRODUCTION: "bg-purple-500",
  NOT_NEEDED: "bg-red-500",
};

export default function ProductionOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const [orderData, setOrderData] = useState<ProductionOrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductionOrderData["items"][0] | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierItems, setSupplierItems] = useState<SupplierItem[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [supplies, setSupplies] = useState<Array<{
    id: string;
    code: string;
    status: string;
    items: Array<{
      productionOrderItemId: string | null;
      quantityOrdered: number;
      quantityReceived: number;
    }>;
  }>>([]);
  const [createSupplyDialogOpen, setCreateSupplyDialogOpen] = useState(false);
  const [createSupplyFormData, setCreateSupplyFormData] = useState({
    supplierId: "",
    warehouseId: "",
    selectedItems: [] as Array<{ itemId: string; quantity: number }>,
  });

  const [formData, setFormData] = useState({
    name: "",
    status: "DRAFT" as string,
    plannedStartAt: "",
    plannedEndAt: "",
    actualStartAt: "",
    actualEndAt: "",
    productionSite: "",
    notes: "",
  });

  const [itemFormData, setItemFormData] = useState({
    supplierId: "",
    supplierItemId: "",
    quantityPlanned: "",
    quantityUnit: "",
    expectedDate: "",
    note: "",
  });

  const [services, setServices] = useState<Array<{
    id: string;
    category: string;
    name: string;
    supplier: { id: string; name: string; code: string } | null;
    totalAmount: number;
    currency: string;
    financialDocument: { number: string; status: string } | null;
    comment: string | null;
  }>>([]);
  const [costSummary, setCostSummary] = useState<{
    materialCost: { total: number; currency: string };
    servicesCost: { total: number; currency: string };
    totalCost: number;
    currency: string;
  } | null>(null);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [serviceFormData, setServiceFormData] = useState({
    supplierId: "",
    category: "",
    name: "",
    quantity: "",
    unit: "",
    pricePerUnit: "",
    totalAmount: "",
    currency: "RUB",
    financialDocumentId: "",
    comment: "",
  });

  useEffect(() => {
    if (orderId) {
      loadOrder();
      loadSuppliers();
      loadWarehouses();
      loadSupplies();
      loadServices();
      loadCostSummary();
    }
  }, [orderId]);

  useEffect(() => {
    if (selectedSupplierId) {
      loadSupplierItems(selectedSupplierId);
    } else {
      setSupplierItems([]);
    }
  }, [selectedSupplierId]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<ProductionOrderData>(
        `/scm/production-orders/${orderId}/with-finance`
      );
      setOrderData(data);
      setFormData({
        name: data.order.name,
        status: data.order.status,
        plannedStartAt: data.order.plannedStartAt
          ? format(new Date(data.order.plannedStartAt), "yyyy-MM-dd'T'HH:mm")
          : "",
        plannedEndAt: data.order.plannedEndAt
          ? format(new Date(data.order.plannedEndAt), "yyyy-MM-dd'T'HH:mm")
          : "",
        actualStartAt: data.order.actualStartAt
          ? format(new Date(data.order.actualStartAt), "yyyy-MM-dd'T'HH:mm")
          : "",
        actualEndAt: data.order.actualEndAt
          ? format(new Date(data.order.actualEndAt), "yyyy-MM-dd'T'HH:mm")
          : "",
        productionSite: data.order.productionSite || "",
        notes: data.order.notes || "",
      });
    } catch (error) {
      console.error("Failed to load production order:", error);
      toast.error("Failed to load production order");
      router.push("/scm/production-orders");
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliers = async () => {
    try {
      const data = await apiRequest<Supplier[]>("/scm/suppliers");
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load suppliers:", error);
    }
  };

  const loadSupplierItems = async (supplierId: string) => {
    try {
      const data = await apiRequest<SupplierItem[]>(
        `/scm/suppliers/${supplierId}/items?isActive=true`
      );
      setSupplierItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load supplier items:", error);
      toast.error("Failed to load supplier items");
      setSupplierItems([]);
    }
  };

  const loadWarehouses = async () => {
    try {
      const data = await apiRequest<Array<{ id: string; name: string; code: string }>>("/scm/warehouses");
      setWarehouses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load warehouses:", error);
    }
  };

  const loadSupplies = async () => {
    try {
      const data = await apiRequest<Array<{
        id: string;
        code: string;
        status: string;
        items: Array<{
          productionOrderItemId: string | null;
          quantityOrdered: number;
          quantityReceived: number;
        }>;
      }>>(`/scm/supplies?productionOrderId=${orderId}`);
      setSupplies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load supplies:", error);
    }
  };

  const handleOpenCreateSupplyDialog = () => {
    if (!orderData || orderData.items.length === 0) {
      toast.error("No components in this order");
      return;
    }
    setCreateSupplyFormData({
      supplierId: "",
      warehouseId: "",
      selectedItems: orderData.items.map((item) => ({
        itemId: item.id,
        quantity: Math.max(0, item.quantityPlanned - (item.quantityReceived || 0)),
      })),
    });
    setCreateSupplyDialogOpen(true);
  };

  const handleCreateSupply = async () => {
    if (!createSupplyFormData.supplierId || !createSupplyFormData.warehouseId) {
      toast.error("Please select supplier and warehouse");
      return;
    }

    const selectedItems = createSupplyFormData.selectedItems.filter(
      (si) => si.quantity > 0
    );

    if (selectedItems.length === 0) {
      toast.error("Please select at least one item with quantity > 0");
      return;
    }

    try {
      setSaving(true);
      const items = selectedItems.map((si) => {
        const orderItem = orderData!.items.find((item) => item.id === si.itemId);
        return {
          supplierItemId: orderItem!.supplierItemId,
          quantityOrdered: si.quantity,
          unit: orderItem!.quantityUnit,
          productionOrderItemId: si.itemId,
        };
      });

      const payload = {
        supplierId: createSupplyFormData.supplierId,
        warehouseId: createSupplyFormData.warehouseId,
        productionOrderId: orderId,
        items,
      };

      const result = await apiRequest<{ id: string }>("/scm/supplies", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success("Supply created successfully");
      setCreateSupplyDialogOpen(false);
      await loadSupplies();
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

  const getSupplyInfoForItem = (itemId: string) => {
    let ordered = 0;
    let received = 0;

    supplies.forEach((supply) => {
      supply.items.forEach((supplyItem) => {
        if (supplyItem.productionOrderItemId === itemId) {
          ordered += supplyItem.quantityOrdered;
          received += supplyItem.quantityReceived;
        }
      });
    });

    return { ordered, received };
  };

  const loadServices = async () => {
    try {
      const data = await apiRequest<Array<{
        id: string;
        category: string;
        name: string;
        supplier: { id: string; name: string; code: string } | null;
        totalAmount: number;
        currency: string;
        financialDocument: { number: string; status: string } | null;
        comment: string | null;
      }>>(`/scm/services?productionOrderId=${orderId}`);
      setServices(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load services:", error);
    }
  };

  const loadCostSummary = async () => {
    try {
      const data = await apiRequest<{
        materialCost: { total: number; currency: string };
        servicesCost: { total: number; currency: string };
        totalCost: number;
        currency: string;
      }>(`/scm/production-orders/${orderId}/cost-summary`);
      setCostSummary(data);
    } catch (error) {
      console.error("Failed to load cost summary:", error);
    }
  };

  const handleOpenServiceDialog = (service?: any) => {
    if (service) {
      setEditingService(service);
      setServiceFormData({
        supplierId: service.supplierId || "",
        category: service.category,
        name: service.name,
        quantity: service.quantity?.toString() || "",
        unit: service.unit || "",
        pricePerUnit: service.pricePerUnit?.toString() || "",
        totalAmount: service.totalAmount.toString(),
        currency: service.currency,
        financialDocumentId: service.financialDocumentId || "",
        comment: service.comment || "",
      });
    } else {
      setEditingService(null);
      setServiceFormData({
        supplierId: "",
        category: "",
        name: "",
        quantity: "",
        unit: "",
        pricePerUnit: "",
        totalAmount: "",
        currency: "RUB",
        financialDocumentId: "",
        comment: "",
      });
    }
    setServiceDialogOpen(true);
  };

  const handleSaveService = async () => {
    if (!serviceFormData.category || !serviceFormData.name || !serviceFormData.totalAmount) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setSaving(true);
      const payload: any = {
        category: serviceFormData.category,
        name: serviceFormData.name,
        productionOrderId: orderId,
        totalAmount: parseFloat(serviceFormData.totalAmount),
        currency: serviceFormData.currency,
      };

      if (serviceFormData.supplierId) payload.supplierId = serviceFormData.supplierId;
      if (serviceFormData.quantity) payload.quantity = parseFloat(serviceFormData.quantity);
      if (serviceFormData.unit) payload.unit = serviceFormData.unit;
      if (serviceFormData.pricePerUnit) payload.pricePerUnit = parseFloat(serviceFormData.pricePerUnit);
      if (serviceFormData.financialDocumentId) payload.financialDocumentId = serviceFormData.financialDocumentId;
      if (serviceFormData.comment) payload.comment = serviceFormData.comment;

      if (editingService) {
        await apiRequest(`/scm/services/${editingService.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Service updated successfully");
      } else {
        await apiRequest("/scm/services", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Service added successfully");
      }

      setServiceDialogOpen(false);
      setEditingService(null);
      await loadServices();
      await loadCostSummary();
    } catch (error: any) {
      console.error("Failed to save service:", error);
      toast.error("Failed to save service", {
        description: error.message || "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteService = async (service: any) => {
    if (!confirm(`Are you sure you want to delete "${service.name}"?`)) {
      return;
    }

    try {
      await apiRequest(`/scm/services/${service.id}`, {
        method: "DELETE",
      });
      toast.success("Service deleted successfully");
      await loadServices();
      await loadCostSummary();
    } catch (error: any) {
      console.error("Failed to delete service:", error);
      toast.error("Failed to delete service", {
        description: error.message || "Unknown error",
      });
    }
  };

  const handleSave = async () => {
    if (!orderData) return;

    try {
      setSaving(true);
      const payload: any = {};

      if (formData.name !== orderData.order.name) payload.name = formData.name;
      if (formData.status !== orderData.order.status) payload.status = formData.status;
      if (formData.plannedStartAt !== (orderData.order.plannedStartAt ? format(new Date(orderData.order.plannedStartAt), "yyyy-MM-dd'T'HH:mm") : "")) {
        payload.plannedStartAt = formData.plannedStartAt || null;
      }
      if (formData.plannedEndAt !== (orderData.order.plannedEndAt ? format(new Date(orderData.order.plannedEndAt), "yyyy-MM-dd'T'HH:mm") : "")) {
        payload.plannedEndAt = formData.plannedEndAt || null;
      }
      if (formData.actualStartAt !== (orderData.order.actualStartAt ? format(new Date(orderData.order.actualStartAt), "yyyy-MM-dd'T'HH:mm") : "")) {
        payload.actualStartAt = formData.actualStartAt || null;
      }
      if (formData.actualEndAt !== (orderData.order.actualEndAt ? format(new Date(orderData.order.actualEndAt), "yyyy-MM-dd'T'HH:mm") : "")) {
        payload.actualEndAt = formData.actualEndAt || null;
      }
      if (formData.productionSite !== (orderData.order.productionSite || "")) {
        payload.productionSite = formData.productionSite || null;
      }
      if (formData.notes !== (orderData.order.notes || "")) {
        payload.notes = formData.notes || null;
      }

      await apiRequest(`/scm/production-orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      toast.success("Production order updated successfully");
      setIsEditing(false);
      await loadOrder();
    } catch (error: any) {
      console.error("Failed to update production order:", error);
      toast.error("Failed to update production order", {
        description: error.message || "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveItem = async () => {
    if (!itemFormData.supplierItemId || !itemFormData.quantityPlanned || !itemFormData.quantityUnit) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setSaving(true);
      const payload: any = {
        supplierItemId: itemFormData.supplierItemId,
        quantityPlanned: parseFloat(itemFormData.quantityPlanned),
        quantityUnit: itemFormData.quantityUnit,
      };

      if (itemFormData.expectedDate) {
        payload.expectedDate = new Date(itemFormData.expectedDate).toISOString();
      }
      if (itemFormData.note) {
        payload.note = itemFormData.note;
      }

      if (editingItem) {
        await apiRequest(`/scm/production-orders/${orderId}/items/${editingItem.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Item updated successfully");
      } else {
        await apiRequest(`/scm/production-orders/${orderId}/items`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Item added successfully");
      }

      setItemDialogOpen(false);
      setEditingItem(null);
      setItemFormData({
        supplierId: "",
        supplierItemId: "",
        quantityPlanned: "",
        quantityUnit: "",
        expectedDate: "",
        note: "",
      });
      setSelectedSupplierId("");
      await loadOrder();
    } catch (error: any) {
      console.error("Failed to save item:", error);
      toast.error("Failed to save item", {
        description: error.message || "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditItem = (item: ProductionOrderData["items"][0]) => {
    setEditingItem(item);
    const supplierId = item.supplierItem.supplier.id;
    setSelectedSupplierId(supplierId);
    setItemFormData({
      supplierId: supplierId,
      supplierItemId: item.supplierItemId,
      quantityPlanned: item.quantityPlanned.toString(),
      quantityUnit: item.quantityUnit,
      expectedDate: item.expectedDate
        ? format(new Date(item.expectedDate), "yyyy-MM-dd'T'HH:mm")
        : "",
      note: item.note || "",
    });
    setItemDialogOpen(true);
  };

  const handleDeleteItem = async (item: ProductionOrderData["items"][0]) => {
    if (!confirm(`Are you sure you want to delete "${item.supplierItem.name}" from this order?`)) {
      return;
    }

    try {
      await apiRequest(`/scm/production-orders/${orderId}/items/${item.id}`, {
        method: "DELETE",
      });
      toast.success("Item deleted successfully");
      await loadOrder();
    } catch (error: any) {
      console.error("Failed to delete item:", error);
      toast.error("Failed to delete item", {
        description: error.message || "Unknown error",
      });
    }
  };

  const handleUpdateItemStatus = async (
    item: ProductionOrderData["items"][0],
    newStatus: string
  ) => {
    try {
      await apiRequest(`/scm/production-orders/${orderId}/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success("Item status updated");
      await loadOrder();
    } catch (error: any) {
      console.error("Failed to update item status:", error);
      toast.error("Failed to update item status");
    }
  };

  const handleOpenNewItemDialog = () => {
    setEditingItem(null);
    setItemFormData({
      supplierId: "",
      supplierItemId: "",
      quantityPlanned: "",
      quantityUnit: "",
      expectedDate: "",
      note: "",
    });
    setSelectedSupplierId("");
    setItemDialogOpen(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd.MM.yyyy HH:mm");
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

  if (!orderData) {
    return (
      <MainLayout>
        <div className="text-center py-8 text-muted-foreground">
          Production order not found
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
              <Link href="/scm/production-orders">← Back to list</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Production Order: {orderData.order.code}</CardTitle>
                <CardDescription>ID: {orderData.order.id}</CardDescription>
              </div>
              <Badge className={STATUS_COLORS[orderData.order.status] || "bg-gray-500"}>
                {orderData.order.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Product</Label>
                  <p className="text-sm font-medium">
                    <Link
                      href={`/scm/products/${orderData.order.productId}`}
                      className="text-blue-600 hover:underline"
                    >
                      {orderData.order.productName}
                    </Link>
                  </p>
                </div>
                <div>
                  <Label>Quantity</Label>
                  <p className="text-sm font-medium">
                    {orderData.order.quantityPlanned} {orderData.order.unit}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  {isEditing ? (
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      disabled={saving}
                    />
                  ) : (
                    <p className="text-sm">{orderData.order.name}</p>
                  )}
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
                        <SelectItem value="PLANNED">PLANNED</SelectItem>
                        <SelectItem value="IN_PROGRESS">IN_PROGRESS</SelectItem>
                        <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                        <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm">{orderData.order.status}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="plannedStartAt">Planned Start</Label>
                  {isEditing ? (
                    <Input
                      id="plannedStartAt"
                      type="datetime-local"
                      value={formData.plannedStartAt}
                      onChange={(e) =>
                        setFormData({ ...formData, plannedStartAt: e.target.value })
                      }
                      disabled={saving}
                    />
                  ) : (
                    <p className="text-sm">{formatDate(orderData.order.plannedStartAt)}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="plannedEndAt">Planned End</Label>
                  {isEditing ? (
                    <Input
                      id="plannedEndAt"
                      type="datetime-local"
                      value={formData.plannedEndAt}
                      onChange={(e) =>
                        setFormData({ ...formData, plannedEndAt: e.target.value })
                      }
                      disabled={saving}
                    />
                  ) : (
                    <p className="text-sm">{formatDate(orderData.order.plannedEndAt)}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="actualStartAt">Actual Start</Label>
                  {isEditing ? (
                    <Input
                      id="actualStartAt"
                      type="datetime-local"
                      value={formData.actualStartAt}
                      onChange={(e) =>
                        setFormData({ ...formData, actualStartAt: e.target.value })
                      }
                      disabled={saving}
                    />
                  ) : (
                    <p className="text-sm">{formatDate(orderData.order.actualStartAt)}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="actualEndAt">Actual End</Label>
                  {isEditing ? (
                    <Input
                      id="actualEndAt"
                      type="datetime-local"
                      value={formData.actualEndAt}
                      onChange={(e) =>
                        setFormData({ ...formData, actualEndAt: e.target.value })
                      }
                      disabled={saving}
                    />
                  ) : (
                    <p className="text-sm">{formatDate(orderData.order.actualEndAt)}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="productionSite">Production Site</Label>
                {isEditing ? (
                  <Input
                    id="productionSite"
                    value={formData.productionSite}
                    onChange={(e) =>
                      setFormData({ ...formData, productionSite: e.target.value })
                    }
                    disabled={saving}
                  />
                ) : (
                  <p className="text-sm">{orderData.order.productionSite || "-"}</p>
                )}
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                {isEditing ? (
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    rows={3}
                    disabled={saving}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{orderData.order.notes || "-"}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="components" className="w-full">
          <TabsList>
            <TabsTrigger value="components">Components</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="cost">Cost Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="components">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Batch Components</CardTitle>
                    <CardDescription>
                      Components from BOM are marked with [BOM] label. Additional components can be added manually.
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleOpenCreateSupplyDialog}>
                      Create Supply
                    </Button>
                    <Button onClick={handleOpenNewItemDialog}>Add Component</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
            {orderData.items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No components in this order. Click "Add Component" to add one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Qty Planned</TableHead>
                      <TableHead>Qty Received</TableHead>
                      <TableHead>In Supplies</TableHead>
                      <TableHead>Expected Date</TableHead>
                      <TableHead>Received Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderData.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.supplierItem.supplier.name}
                        </TableCell>
                        <TableCell>
                          {item.supplierItem.name}
                          {item.fromBom && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              BOM
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{item.supplierItem.type}</TableCell>
                        <TableCell>{item.supplierItem.category}</TableCell>
                        <TableCell>
                          {item.quantityPlanned} {item.quantityUnit}
                        </TableCell>
                        <TableCell>
                          {item.quantityReceived !== null
                            ? `${item.quantityReceived} ${item.quantityUnit}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const supplyInfo = getSupplyInfoForItem(item.id);
                            return supplyInfo.ordered > 0
                              ? `${supplyInfo.received} / ${supplyInfo.ordered} ${item.quantityUnit}`
                              : "-";
                          })()}
                        </TableCell>
                        <TableCell>{formatDate(item.expectedDate)}</TableCell>
                        <TableCell>{formatDate(item.receivedDate)}</TableCell>
                        <TableCell>
                          <Select
                            value={item.status}
                            onValueChange={(value) =>
                              handleUpdateItemStatus(item, value)
                            }
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PLANNED">PLANNED</SelectItem>
                              <SelectItem value="ORDERED">ORDERED</SelectItem>
                              <SelectItem value="PARTIALLY_RECEIVED">
                                PARTIALLY_RECEIVED
                              </SelectItem>
                              <SelectItem value="RECEIVED">RECEIVED</SelectItem>
                              <SelectItem value="USED_IN_PRODUCTION">
                                USED_IN_PRODUCTION
                              </SelectItem>
                              <SelectItem value="NOT_NEEDED">NOT_NEEDED</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {item.note || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditItem(item)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteItem(item)}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="services">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Services</CardTitle>
                    <CardDescription>
                      Services related to this production order
                    </CardDescription>
                  </div>
                  <Button onClick={() => handleOpenServiceDialog()}>Add Service</Button>
                </div>
              </CardHeader>
              <CardContent>
                {services.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No services found. Click "Add Service" to add one.
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
                          <TableHead>Document</TableHead>
                          <TableHead>Comment</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {services.map((service) => (
                          <TableRow key={service.id}>
                            <TableCell>{service.category}</TableCell>
                            <TableCell className="font-medium">{service.name}</TableCell>
                            <TableCell>{service.supplier?.name || "-"}</TableCell>
                            <TableCell>{service.totalAmount}</TableCell>
                            <TableCell>{service.currency}</TableCell>
                            <TableCell>
                              {service.financialDocument ? (
                                <span>
                                  {service.financialDocument.number} ({service.financialDocument.status})
                                </span>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {service.comment || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenServiceDialog(service)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteService(service)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cost">
            <Card>
              <CardHeader>
                <CardTitle>Cost Summary</CardTitle>
                <CardDescription>
                  Total cost breakdown for this production order
                </CardDescription>
              </CardHeader>
              <CardContent>
                {costSummary ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Materials Cost</Label>
                        <p className="text-2xl font-bold">
                          {costSummary.materialCost.total.toLocaleString()} {costSummary.materialCost.currency}
                        </p>
                      </div>
                      <div>
                        <Label>Services Cost</Label>
                        <p className="text-2xl font-bold">
                          {costSummary.servicesCost.total.toLocaleString()} {costSummary.servicesCost.currency}
                        </p>
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <Label>Total Cost</Label>
                      <p className="text-3xl font-bold">
                        {costSummary.totalCost.toLocaleString()} {costSummary.currency}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading cost summary...
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="finance">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Financial Documents</CardTitle>
                  <Button
                    variant="outline"
                    asChild
                  >
                    <Link
                      href={`/finance/documents/new?productionOrderId=${orderData.order.id}`}
                    >
                      Create Document
                    </Link>
                  </Button>
                </div>
                <CardDescription>
                  Financial documents related to this production order
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!orderData.financialDocuments || orderData.financialDocuments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No financial documents. Click "Create Document" to add one.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Number</TableHead>
                        <TableHead>Issue Date</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderData.financialDocuments.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell>
                            <Badge variant="outline">{doc.type}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{doc.number}</TableCell>
                          <TableCell>
                            {doc.issueDate
                              ? format(new Date(doc.issueDate), "dd.MM.yyyy")
                              : format(new Date(doc.date), "dd.MM.yyyy")}
                          </TableCell>
                          <TableCell>
                            {doc.dueDate
                              ? format(new Date(doc.dueDate), "dd.MM.yyyy")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {doc.totalAmount.toLocaleString()} {doc.currency}
                          </TableCell>
                          <TableCell>
                            {doc.amountPaid.toLocaleString()} {doc.currency}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                STATUS_COLORS[doc.status] || "bg-gray-500"
                              }
                            >
                              {doc.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/finance/documents/${doc.id}`}>
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
          </TabsContent>
        </Tabs>

        {/* Item Dialog */}
        <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? "Edit Component" : "Add Component"}
              </DialogTitle>
              <DialogDescription>
                {editingItem
                  ? "Update the component details below"
                  : "Add a component that is not in BOM"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="item-supplier">Supplier *</Label>
                <Select
                  value={itemFormData.supplierId}
                  onValueChange={(value) => {
                    setItemFormData({ ...itemFormData, supplierId: value, supplierItemId: "" });
                    setSelectedSupplierId(value);
                  }}
                  disabled={!!editingItem}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="item-position">Position (Supplier Item) *</Label>
                <Select
                  value={itemFormData.supplierItemId}
                  onValueChange={(value) =>
                    setItemFormData({ ...itemFormData, supplierItemId: value })
                  }
                  disabled={!selectedSupplierId && !editingItem}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an item" />
                  </SelectTrigger>
                  <SelectContent>
                    {supplierItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.type}, {item.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSupplierId && supplierItems.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    No active items found for this supplier
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="item-quantity">Quantity Planned *</Label>
                  <Input
                    id="item-quantity"
                    type="number"
                    step="0.01"
                    value={itemFormData.quantityPlanned}
                    onChange={(e) =>
                      setItemFormData({ ...itemFormData, quantityPlanned: e.target.value })
                    }
                    placeholder="5200"
                  />
                </div>
                <div>
                  <Label htmlFor="item-unit">Unit *</Label>
                  <Input
                    id="item-unit"
                    value={itemFormData.quantityUnit}
                    onChange={(e) =>
                      setItemFormData({ ...itemFormData, quantityUnit: e.target.value })
                    }
                    placeholder="pcs"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="item-expectedDate">Expected Date</Label>
                <Input
                  id="item-expectedDate"
                  type="datetime-local"
                  value={itemFormData.expectedDate}
                  onChange={(e) =>
                    setItemFormData({ ...itemFormData, expectedDate: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="item-note">Note</Label>
                <Textarea
                  id="item-note"
                  value={itemFormData.note}
                  onChange={(e) =>
                    setItemFormData({ ...itemFormData, note: e.target.value })
                  }
                  placeholder="Additional notes about this component"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setItemDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveItem} disabled={saving}>
                {saving ? "Saving..." : editingItem ? "Update" : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Supply Dialog */}
        <Dialog open={createSupplyDialogOpen} onOpenChange={setCreateSupplyDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Supply from Production Order</DialogTitle>
              <DialogDescription>
                Create a supply order for selected components. Quantities are pre-filled with remaining needed amounts.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="supply-supplier">Supplier *</Label>
                <Select
                  value={createSupplyFormData.supplierId}
                  onValueChange={(value) =>
                    setCreateSupplyFormData({ ...createSupplyFormData, supplierId: value })
                  }
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="supply-warehouse">Warehouse *</Label>
                <Select
                  value={createSupplyFormData.warehouseId}
                  onValueChange={(value) =>
                    setCreateSupplyFormData({ ...createSupplyFormData, warehouseId: value })
                  }
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} ({warehouse.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Select Components</Label>
                <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-4">
                  {orderData?.items.map((item) => {
                    const selectedItem = createSupplyFormData.selectedItems.find(
                      (si) => si.itemId === item.id
                    );
                    const remaining = Math.max(0, item.quantityPlanned - (item.quantityReceived || 0));
                    return (
                      <div key={item.id} className="flex items-center gap-4 p-2 border rounded">
                        <div className="flex-1">
                          <div className="font-medium">{item.supplierItem.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Planned: {item.quantityPlanned} {item.quantityUnit} | 
                            Received: {item.quantityReceived || 0} {item.quantityUnit} | 
                            Remaining: {remaining} {item.quantityUnit}
                          </div>
                        </div>
                        <div className="w-32">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max={remaining}
                            value={selectedItem?.quantity || 0}
                            onChange={(e) => {
                              const newQuantity = parseFloat(e.target.value) || 0;
                              setCreateSupplyFormData({
                                ...createSupplyFormData,
                                selectedItems: createSupplyFormData.selectedItems.map((si) =>
                                  si.itemId === item.id
                                    ? { ...si, quantity: Math.min(newQuantity, remaining) }
                                    : si
                                ),
                              });
                            }}
                            disabled={saving || remaining <= 0}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateSupplyDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateSupply} disabled={saving}>
                {saving ? "Creating..." : "Create Supply"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

