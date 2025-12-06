"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { format } from "date-fns";
import Link from "next/link";

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
  items: SupplyItem[];
  financialDocuments?: FinancialDocument[];
  createdAt: string;
  updatedAt: string;
}

interface SupplyItem {
  id: string;
  supplierItemId: string | null;
  supplierItem: {
    id: string;
    name: string;
    code: string;
    type: string;
    category: string;
    unit: string;
    supplier: {
      id: string;
      name: string;
      code: string;
    };
  } | null;
  productId: string | null;
  product: {
    id: string;
    name: string;
  } | null;
  description: string | null;
  quantityOrdered: number;
  quantityReceived: number;
  unit: string;
  pricePerUnit: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

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

interface SupplierItem {
  id: string;
  name: string;
  code: string;
  unit: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-500",
  ORDERED: "bg-blue-500",
  PARTIAL_RECEIVED: "bg-orange-500",
  RECEIVED: "bg-green-500",
  CANCELED: "bg-red-500",
};

export default function SupplyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const supplyId = params.id as string;

  const [supply, setSupply] = useState<Supply | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [supplierItems, setSupplierItems] = useState<SupplierItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SupplyItem | null>(null);

  const [formData, setFormData] = useState({
    supplierId: "",
    warehouseId: "",
    productionOrderId: "",
    status: "DRAFT" as string,
    currency: "RUB",
    orderDate: "",
    expectedDate: "",
    receivedDate: "",
    comment: "",
  });

  const [itemFormData, setItemFormData] = useState({
    supplierItemId: "",
    productId: "",
    description: "",
    unit: "",
    quantityOrdered: 0,
    quantityReceived: 0,
    pricePerUnit: 0,
    currency: "RUB",
  });

  useEffect(() => {
    if (supplyId) {
      loadSupply();
      loadSuppliers();
      loadWarehouses();
      loadProductionOrders();
    }
  }, [supplyId]);

  const loadSupply = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<Supply>(`/scm/supplies/${supplyId}/with-finance`);
      setSupply(data);
      setFormData({
        supplierId: data.supplierId,
        warehouseId: data.warehouseId,
        productionOrderId: data.productionOrderId || "",
        status: data.status,
        currency: data.currency,
        orderDate: data.orderDate
          ? format(new Date(data.orderDate), "yyyy-MM-dd'T'HH:mm")
          : "",
        expectedDate: data.expectedDate
          ? format(new Date(data.expectedDate), "yyyy-MM-dd'T'HH:mm")
          : "",
        receivedDate: data.receivedDate
          ? format(new Date(data.receivedDate), "yyyy-MM-dd'T'HH:mm")
          : "",
        comment: data.comment || "",
      });
    } catch (error) {
      console.error("Failed to load supply:", error);
      toast.error("Failed to load supply");
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

  const loadWarehouses = async () => {
    try {
      const data = await apiRequest<Warehouse[]>("/scm/warehouses?isActive=true");
      setWarehouses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load warehouses:", error);
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

  const loadSupplierItems = async (supplierId: string) => {
    try {
      const data = await apiRequest<SupplierItem[]>(`/scm/suppliers/${supplierId}/items`);
      setSupplierItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load supplier items:", error);
      setSupplierItems([]);
    }
  };

  const handleSave = async () => {
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
      if (formData.receivedDate) {
        payload.receivedDate = formData.receivedDate;
      }
      if (formData.comment) {
        payload.comment = formData.comment;
      }

      await apiRequest(`/scm/supplies/${supplyId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      toast.success("Supply updated successfully");
      await loadSupply();
    } catch (error: any) {
      console.error("Failed to save supply:", error);
      toast.error("Failed to save supply", {
        description: error.message || "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenItemDialog = (item?: SupplyItem) => {
    if (item) {
      setEditingItem(item);
      setItemFormData({
        supplierItemId: item.supplierItemId || "",
        productId: item.productId || "",
        description: item.description || "",
        unit: item.unit,
        quantityOrdered: item.quantityOrdered,
        quantityReceived: item.quantityReceived,
        pricePerUnit: item.pricePerUnit,
        currency: item.currency,
      });
    } else {
      setEditingItem(null);
      setItemFormData({
        supplierItemId: "",
        productId: "",
        description: "",
        unit: "",
        quantityOrdered: 0,
        quantityReceived: 0,
        pricePerUnit: 0,
        currency: supply?.currency || "RUB",
      });
      if (formData.supplierId) {
        loadSupplierItems(formData.supplierId);
      }
    }
    setItemDialogOpen(true);
  };

  const handleSaveItem = async () => {
    if (!itemFormData.unit || !itemFormData.currency) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setSaving(true);
      const payload: any = {
        unit: itemFormData.unit,
        quantityOrdered: itemFormData.quantityOrdered,
        pricePerUnit: itemFormData.pricePerUnit,
        currency: itemFormData.currency,
      };

      if (itemFormData.supplierItemId) {
        payload.supplierItemId = itemFormData.supplierItemId;
      }
      if (itemFormData.productId) {
        payload.productId = itemFormData.productId;
      }
      if (itemFormData.description) {
        payload.description = itemFormData.description;
      }
      if (itemFormData.quantityReceived) {
        payload.quantityReceived = itemFormData.quantityReceived;
      }

      if (editingItem) {
        await apiRequest(`/scm/supplies/${supplyId}/items/${editingItem.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Item updated successfully");
      } else {
        await apiRequest(`/scm/supplies/${supplyId}/items`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Item added successfully");
      }

      setItemDialogOpen(false);
      await loadSupply();
    } catch (error: any) {
      console.error("Failed to save item:", error);
      toast.error("Failed to save item", {
        description: error.message || "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this item?")) {
      return;
    }

    try {
      await apiRequest(`/scm/supplies/${supplyId}/items/${itemId}`, {
        method: "DELETE",
      });
      toast.success("Item deleted successfully");
      await loadSupply();
    } catch (error: any) {
      console.error("Failed to delete item:", error);
      toast.error("Failed to delete item", {
        description: error.message || "Unknown error",
      });
    }
  };

  const getItemName = (item: SupplyItem): string => {
    if (item.supplierItem) {
      return item.supplierItem.name + (item.supplierItem.code ? ` [${item.supplierItem.code}]` : "");
    }
    if (item.product) {
      return item.product.name;
    }
    if (item.description) {
      return item.description;
    }
    return "Unknown";
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-8">Loading...</div>
      </MainLayout>
    );
  }

  if (!supply) {
    return (
      <MainLayout>
        <div className="text-center py-8">Supply not found</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Supply {supply.code}</h1>
            <p className="text-muted-foreground mt-2">Manage supply details and items</p>
          </div>
          <Button variant="outline" onClick={() => router.push("/scm/supplies")}>
            Back to List
          </Button>
        </div>

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="items">Items ({supply.items.length})</TabsTrigger>
            <TabsTrigger value="receive">Receive</TabsTrigger>
            <TabsTrigger value="finance">
              Finance ({supply.financialDocuments?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Supply Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="supplierId">Supplier *</Label>
                    <Select
                      value={formData.supplierId}
                      onValueChange={(value) => {
                        setFormData({ ...formData, supplierId: value });
                        loadSupplierItems(value);
                      }}
                      disabled={saving}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select supplier" />
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
                    <Label htmlFor="warehouseId">Warehouse *</Label>
                    <Select
                      value={formData.warehouseId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, warehouseId: value })
                      }
                      disabled={saving}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((warehouse) => (
                          <SelectItem key={warehouse.id} value={warehouse.id}>
                            {warehouse.name} ({warehouse.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="productionOrderId">Production Order</Label>
                    <Select
                      value={formData.productionOrderId}
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
                        {productionOrders.map((order) => (
                          <SelectItem key={order.id} value={order.id}>
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

                  <div>
                    <Label htmlFor="receivedDate">Received Date</Label>
                    <Input
                      id="receivedDate"
                      type="datetime-local"
                      value={formData.receivedDate}
                      onChange={(e) =>
                        setFormData({ ...formData, receivedDate: e.target.value })
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

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={saving}>
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="items">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Items</CardTitle>
                  <Button onClick={() => handleOpenItemDialog()}>Add Item</Button>
                </div>
              </CardHeader>
              <CardContent>
                {supply.items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No items. Click "Add Item" to add one.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Quantity Ordered</TableHead>
                        <TableHead>Quantity Received</TableHead>
                        <TableHead>Price per Unit</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supply.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {getItemName(item)}
                          </TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell>{item.quantityOrdered}</TableCell>
                          <TableCell>{item.quantityReceived}</TableCell>
                          <TableCell>{item.pricePerUnit}</TableCell>
                          <TableCell>{item.currency}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenItemDialog(item)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteItem(item.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receive">
            <Card>
              <CardHeader>
                <CardTitle>Receive Supply</CardTitle>
                <CardDescription>
                  Record received quantities for supply items
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ReceiveSupplyForm
                  supply={supply}
                  onReceive={async () => {
                    await loadSupply();
                  }}
                />
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
                      href={`/finance/documents/new?supplyId=${supply.id}&supplierId=${supply.supplierId}`}
                    >
                      Create Document
                    </Link>
                  </Button>
                </div>
                <CardDescription>
                  Financial documents related to this supply
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!supply.financialDocuments || supply.financialDocuments.length === 0 ? (
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
                      {supply.financialDocuments.map((doc) => (
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

        <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? "Edit Item" : "Add Item"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="supplierItemId">Supplier Item</Label>
                <Select
                  value={itemFormData.supplierItemId}
                  onValueChange={(value) =>
                    setItemFormData({ ...itemFormData, supplierItemId: value })
                  }
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier item" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {supplierItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} [{item.code}]
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={itemFormData.description}
                  onChange={(e) =>
                    setItemFormData({ ...itemFormData, description: e.target.value })
                  }
                  placeholder="Item description (if no supplier item selected)"
                  rows={2}
                  disabled={saving}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="unit">Unit *</Label>
                  <Input
                    id="unit"
                    value={itemFormData.unit}
                    onChange={(e) =>
                      setItemFormData({ ...itemFormData, unit: e.target.value })
                    }
                    placeholder="pcs"
                    disabled={saving}
                  />
                </div>

                <div>
                  <Label htmlFor="quantityOrdered">Quantity Ordered *</Label>
                  <Input
                    id="quantityOrdered"
                    type="number"
                    value={itemFormData.quantityOrdered}
                    onChange={(e) =>
                      setItemFormData({
                        ...itemFormData,
                        quantityOrdered: parseFloat(e.target.value) || 0,
                      })
                    }
                    disabled={saving}
                  />
                </div>

                <div>
                  <Label htmlFor="quantityReceived">Quantity Received</Label>
                  <Input
                    id="quantityReceived"
                    type="number"
                    value={itemFormData.quantityReceived}
                    onChange={(e) =>
                      setItemFormData({
                        ...itemFormData,
                        quantityReceived: parseFloat(e.target.value) || 0,
                      })
                    }
                    disabled={saving}
                  />
                </div>

                <div>
                  <Label htmlFor="pricePerUnit">Price per Unit *</Label>
                  <Input
                    id="pricePerUnit"
                    type="number"
                    step="0.01"
                    value={itemFormData.pricePerUnit}
                    onChange={(e) =>
                      setItemFormData({
                        ...itemFormData,
                        pricePerUnit: parseFloat(e.target.value) || 0,
                      })
                    }
                    disabled={saving}
                  />
                </div>

                <div>
                  <Label htmlFor="itemCurrency">Currency *</Label>
                  <Input
                    id="itemCurrency"
                    value={itemFormData.currency}
                    onChange={(e) =>
                      setItemFormData({ ...itemFormData, currency: e.target.value })
                    }
                    placeholder="RUB"
                    disabled={saving}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setItemDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveItem} disabled={saving}>
                {editingItem ? "Update" : "Add"} Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

function ReceiveSupplyForm({
  supply,
  onReceive,
}: {
  supply: Supply;
  onReceive: () => Promise<void>;
}) {
  const [receiveData, setReceiveData] = useState<
    Record<string, { quantityToReceive: number }>
  >({});
  const [receivedDate, setReceivedDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [comment, setComment] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const handleQuantityChange = (itemId: string, value: number) => {
    setReceiveData((prev) => ({
      ...prev,
      [itemId]: { quantityToReceive: Math.max(0, value) },
    }));
  };

  const handleReceive = async () => {
    const items = Object.entries(receiveData)
      .filter(([_, data]) => data.quantityToReceive > 0)
      .map(([itemId, data]) => ({
        itemId,
        quantityToReceive: data.quantityToReceive,
      }));

    if (items.length === 0) {
      toast.error("Please enter quantities to receive");
      return;
    }

    try {
      setSaving(true);
      const payload: any = {
        items,
      };

      if (receivedDate) {
        payload.receivedDate = new Date(receivedDate).toISOString();
      }
      if (comment) {
        payload.comment = comment;
      }

      await apiRequest(`/scm/supplies/${supply.id}/receive`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success("Supply received successfully");
      setReceiveData({});
      setComment("");
      await onReceive();
    } catch (error: any) {
      console.error("Failed to receive supply:", error);
      toast.error("Failed to receive supply", {
        description: error.message || "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const getItemName = (item: SupplyItem): string => {
    if (item.supplierItem) {
      return item.supplierItem.name + (item.supplierItem.code ? ` [${item.supplierItem.code}]` : "");
    }
    if (item.product) {
      return item.product.name;
    }
    if (item.description) {
      return item.description;
    }
    return "Unknown";
  };

  const getRemainingQuantity = (item: SupplyItem): number => {
    return item.quantityOrdered - item.quantityReceived;
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="receivedDate">Received Date</Label>
        <Input
          id="receivedDate"
          type="datetime-local"
          value={receivedDate}
          onChange={(e) => setReceivedDate(e.target.value)}
          disabled={saving}
        />
      </div>

      <div>
        <Label htmlFor="receiveComment">Comment</Label>
        <Textarea
          id="receiveComment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Additional notes about this receive"
          rows={2}
          disabled={saving}
        />
      </div>

      <div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Ordered</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead>Quantity to Receive</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {supply.items.map((item) => {
              const remaining = getRemainingQuantity(item);
              const currentReceive = receiveData[item.id]?.quantityToReceive || 0;
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {getItemName(item)}
                  </TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell>{item.quantityOrdered}</TableCell>
                  <TableCell>{item.quantityReceived}</TableCell>
                  <TableCell>
                    <span className={remaining > 0 ? "text-orange-600" : "text-green-600"}>
                      {remaining}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={remaining}
                      value={currentReceive}
                      onChange={(e) =>
                        handleQuantityChange(
                          item.id,
                          parseFloat(e.target.value) || 0
                        )
                      }
                      disabled={saving || remaining <= 0}
                      className="w-24"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleReceive} disabled={saving}>
          {saving ? "Receiving..." : "Confirm Receive"}
        </Button>
      </div>
    </div>
  );
}
