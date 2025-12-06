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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";

interface ScmProduct {
  id: string;
  internalName: string;
  sku: string | null;
  type?: "MANUFACTURED" | "PURCHASED";
  brand: {
    id: string;
    name: string;
    code: string;
  } | null;
  baseDescription: string | null;
  composition: string | null;
  createdAt: string;
  updatedAt: string;
  listings: Array<{
    id: string;
    name: string;
    marketplace: {
      id: string;
      name: string;
      code: string;
    } | null;
  }>;
  suppliers?: Array<{
    id: string;
    role: string;
    leadTimeDays: number | null;
    minOrderQty: number | null;
    supplier: {
      id: string;
      name: string;
      type: string;
      country: {
        id: string;
        name: string;
        code: string;
      } | null;
    };
  }>;
}

interface BomData {
  product: {
    id: string;
    name: string;
    type: "MANUFACTURED" | "PURCHASED";
    sku: string | null;
  };
  items: Array<{
    id: string;
    supplierItemId: string;
    quantity: number;
    unit: string;
    wastagePercent: number | null;
    isOptional: boolean;
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

interface Brand {
  id: string;
  name: string;
  code: string;
}

export default function ScmProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;
  const [product, setProduct] = useState<ScmProduct | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // BOM state
  const [bomData, setBomData] = useState<BomData | null>(null);
  const [bomLoading, setBomLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierItems, setSupplierItems] = useState<SupplierItem[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [bomDialogOpen, setBomDialogOpen] = useState(false);
  const [editingBomItem, setEditingBomItem] = useState<BomData["items"][0] | null>(null);
  
  const [bomFormData, setBomFormData] = useState({
    supplierId: "",
    supplierItemId: "",
    quantity: "",
    unit: "",
    wastagePercent: "",
    isOptional: false,
    note: "",
  });

  const [formData, setFormData] = useState({
    internalName: "",
    sku: "",
    brandId: "",
    baseDescription: "",
    composition: "",
    type: "PURCHASED" as "MANUFACTURED" | "PURCHASED",
  });

  useEffect(() => {
    if (productId) {
      loadProduct();
      loadBrands();
      loadSuppliers();
    }
  }, [productId]);

  useEffect(() => {
    if (selectedSupplierId) {
      loadSupplierItems(selectedSupplierId);
    } else {
      setSupplierItems([]);
    }
  }, [selectedSupplierId]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<ScmProduct>(`/scm/products/${productId}`);
      if (data) {
        setProduct(data);
        setFormData({
          internalName: data.internalName || "",
          sku: data.sku || "",
          brandId: data.brand?.id || "",
          baseDescription: data.baseDescription || "",
          composition: data.composition || "",
          type: data.type || "PURCHASED",
        });
      }
    } catch (error) {
      console.error("Failed to load SCM product:", error);
      toast.error("Failed to load SCM product", {
        description: error instanceof Error ? error.message : "Product not found",
      });
      setTimeout(() => router.push("/scm/products"), 2000);
    } finally {
      setLoading(false);
    }
  };

  const loadBrands = async () => {
    try {
      const data = await apiRequest<Brand[]>("/bcm/brands");
      setBrands(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load brands:", error);
      toast.error("Failed to load brands");
    }
  };

  const loadBom = async () => {
    if (!productId) return;
    try {
      setBomLoading(true);
      const data = await apiRequest<BomData>(`/scm/products/${productId}/bom`);
      setBomData(data);
    } catch (error) {
      console.error("Failed to load BOM:", error);
      toast.error("Failed to load BOM");
    } finally {
      setBomLoading(false);
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

  const handleSaveBomItem = async () => {
    if (!bomFormData.supplierItemId || !bomFormData.quantity || !bomFormData.unit) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setSaving(true);
      const payload: any = {
        supplierItemId: bomFormData.supplierItemId,
        quantity: parseFloat(bomFormData.quantity),
        unit: bomFormData.unit,
        isOptional: bomFormData.isOptional,
      };

      if (bomFormData.wastagePercent) {
        payload.wastagePercent = parseFloat(bomFormData.wastagePercent);
      }
      if (bomFormData.note) {
        payload.note = bomFormData.note;
      }

      if (editingBomItem) {
        await apiRequest(`/scm/products/${productId}/bom/items/${editingBomItem.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("BOM item updated successfully");
      } else {
        await apiRequest(`/scm/products/${productId}/bom/items`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("BOM item created successfully");
      }

      setBomDialogOpen(false);
      setEditingBomItem(null);
      setBomFormData({
        supplierId: "",
        supplierItemId: "",
        quantity: "",
        unit: "",
        wastagePercent: "",
        isOptional: false,
        note: "",
      });
      setSelectedSupplierId("");
      await loadBom();
    } catch (error: any) {
      console.error("Failed to save BOM item:", error);
      toast.error("Failed to save BOM item", {
        description: error.message || "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditBomItem = (item: BomData["items"][0]) => {
    setEditingBomItem(item);
    const supplierId = item.supplierItem.supplier.id;
    setSelectedSupplierId(supplierId);
    setBomFormData({
      supplierId: supplierId,
      supplierItemId: item.supplierItemId,
      quantity: item.quantity.toString(),
      unit: item.unit,
      wastagePercent: item.wastagePercent?.toString() || "",
      isOptional: item.isOptional,
      note: item.note || "",
    });
    setBomDialogOpen(true);
  };

  const handleDeleteBomItem = async (item: BomData["items"][0]) => {
    if (!confirm(`Are you sure you want to delete "${item.supplierItem.name}" from BOM?`)) {
      return;
    }

    try {
      await apiRequest(`/scm/products/${productId}/bom/items/${item.id}`, {
        method: "DELETE",
      });
      toast.success("BOM item deleted successfully");
      await loadBom();
    } catch (error: any) {
      console.error("Failed to delete BOM item:", error);
      toast.error("Failed to delete BOM item", {
        description: error.message || "Unknown error",
      });
    }
  };

  const handleOpenNewBomDialog = () => {
    setEditingBomItem(null);
    setBomFormData({
      supplierId: "",
      supplierItemId: "",
      quantity: "",
      unit: "",
      wastagePercent: "",
      isOptional: false,
      note: "",
    });
    setSelectedSupplierId("");
    setBomDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.internalName.trim()) {
      toast.error("Internal name is required");
      return;
    }

    try {
      setSaving(true);
      const payload: {
        internalName?: string;
        sku?: string | null;
        brandId?: string | null;
        baseDescription?: string | null;
        composition?: string | null;
        type?: "MANUFACTURED" | "PURCHASED";
      } = {};

      if (formData.internalName !== product?.internalName) {
        payload.internalName = formData.internalName;
      }
      if (formData.sku !== (product?.sku || "")) {
        payload.sku = formData.sku || null;
      }
      if (formData.brandId !== (product?.brand?.id || "")) {
        payload.brandId = formData.brandId || null;
      }
      if (formData.baseDescription !== (product?.baseDescription || "")) {
        payload.baseDescription = formData.baseDescription || null;
      }
      if (formData.composition !== (product?.composition || "")) {
        payload.composition = formData.composition || null;
      }
      if (formData.type !== (product?.type || "PURCHASED")) {
        payload.type = formData.type;
      }

      await apiRequest(`/scm/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      toast.success("SCM product updated successfully");
      setIsEditing(false);
      await loadProduct();
    } catch (error: any) {
      console.error("Failed to update SCM product:", error);
      toast.error("Failed to update SCM product", {
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

  if (!product) {
    return (
      <MainLayout>
        <div className="text-center py-8 text-muted-foreground">
          SCM product not found
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
              <Link href="/scm/products">← Back to list</Link>
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

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="bom" onClick={loadBom}>Состав / BOM</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>SCM Product Details</CardTitle>
            <CardDescription>ID: {product.id}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="internalName" className="text-right">
                  Internal Name
                </Label>
                {isEditing ? (
                  <Input
                    id="internalName"
                    value={formData.internalName}
                    onChange={(e) =>
                      setFormData({ ...formData, internalName: e.target.value })
                    }
                    className="col-span-3"
                    required
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{product.internalName}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="sku" className="text-right">
                  SKU
                </Label>
                {isEditing ? (
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="col-span-3"
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{product.sku || "-"}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">
                  Type
                </Label>
                {isEditing ? (
                  <Select
                    value={formData.type}
                    onValueChange={(value: "MANUFACTURED" | "PURCHASED") =>
                      setFormData({ ...formData, type: value })
                    }
                    disabled={saving}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANUFACTURED">Manufactured</SelectItem>
                      <SelectItem value="PURCHASED">Purchased</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="col-span-3">{product.type || "PURCHASED"}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="brand" className="text-right">
                  Brand
                </Label>
                {isEditing ? (
                  <Select
                    value={formData.brandId}
                    onValueChange={(value) => setFormData({ ...formData, brandId: value })}
                    disabled={saving}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select a brand" />
                    </SelectTrigger>
                  <SelectContent>
                    {(brands || []).map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                  </Select>
                ) : (
                  <div className="col-span-3">{product.brand?.name || "-"}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="baseDescription" className="text-right pt-2">
                  Base Description
                </Label>
                {isEditing ? (
                  <Textarea
                    id="baseDescription"
                    value={formData.baseDescription}
                    onChange={(e) =>
                      setFormData({ ...formData, baseDescription: e.target.value })
                    }
                    className="col-span-3"
                    rows={4}
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{product.baseDescription || "-"}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="composition" className="text-right pt-2">
                  Composition
                </Label>
                {isEditing ? (
                  <Textarea
                    id="composition"
                    value={formData.composition}
                    onChange={(e) =>
                      setFormData({ ...formData, composition: e.target.value })
                    }
                    className="col-span-3"
                    rows={3}
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{product.composition || "-"}</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Marketplace Listings</CardTitle>
            <CardDescription>
              {product.listings.length} listing(s) linked to this SCM product
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(!product.listings || product.listings.length === 0) ? (
              <div className="text-center py-8 text-muted-foreground">
                No listings linked to this SCM product
              </div>
            ) : (
              <div className="space-y-2">
                {(product.listings || []).map((listing) => (
                  <div
                    key={listing.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <div className="font-medium">{listing.name}</div>
                      {listing.marketplace && (
                        <div className="text-sm text-muted-foreground">
                          {listing.marketplace.name}
                        </div>
                      )}
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/bcm/products/${listing.id}`}>View Listing</Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suppliers</CardTitle>
            <CardDescription>
              {product.suppliers?.length || 0} supplier(s) linked to this SCM product
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(!product.suppliers || product.suppliers.length === 0) ? (
              <div className="text-center py-8 text-muted-foreground">
                No suppliers linked to this SCM product
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Lead Time (days)</TableHead>
                      <TableHead>Min Order Qty</TableHead>
                      <TableHead>Country / Type</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(product.suppliers || []).map((link) => (
                      <TableRow key={link.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/scm/suppliers/${link.supplier.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {link.supplier.name}
                          </Link>
                        </TableCell>
                        <TableCell>{link.role}</TableCell>
                        <TableCell>{link.leadTimeDays || "-"}</TableCell>
                        <TableCell>{link.minOrderQty || "-"}</TableCell>
                        <TableCell>
                          {link.supplier.country?.name || "-"} / {link.supplier.type}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/scm/suppliers/${link.supplier.id}`}>
                              View Supplier
                            </Link>
                          </Button>
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

          <TabsContent value="bom" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Bill of Materials (BOM)</CardTitle>
                    <CardDescription>
                      {bomData?.product.type === "PURCHASED"
                        ? "Для закупаемых товаров состав не обязателен, но может быть настроен при необходимости"
                        : "Состав продукта из компонентов поставщиков"}
                    </CardDescription>
                  </div>
                  <Button onClick={handleOpenNewBomDialog}>Add Component</Button>
                </div>
              </CardHeader>
              <CardContent>
                {bomLoading ? (
                  <div className="text-center py-8">Loading BOM...</div>
                ) : !bomData ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Failed to load BOM
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                      <div>
                        <Label className="text-sm font-medium">Product</Label>
                        <p className="text-sm">{bomData.product.name}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Type</Label>
                        <p className="text-sm">{bomData.product.type}</p>
                      </div>
                    </div>

                    {bomData.items.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No components in BOM. Click "Add Component" to create one.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Position</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Unit</TableHead>
                            <TableHead>Wastage %</TableHead>
                            <TableHead>Optional</TableHead>
                            <TableHead>Note</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bomData.items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">
                                {item.supplierItem.supplier.name}
                              </TableCell>
                              <TableCell>{item.supplierItem.name}</TableCell>
                              <TableCell>{item.supplierItem.type}</TableCell>
                              <TableCell>{item.supplierItem.category}</TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell>{item.unit}</TableCell>
                              <TableCell>{item.wastagePercent || "-"}</TableCell>
                              <TableCell>
                                {item.isOptional ? (
                                  <span className="text-green-600">Yes</span>
                                ) : (
                                  <span className="text-gray-400">No</span>
                                )}
                              </TableCell>
                              <TableCell className="max-w-xs truncate">
                                {item.note || "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditBomItem(item)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteBomItem(item)}
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
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* BOM Item Dialog */}
        <Dialog open={bomDialogOpen} onOpenChange={setBomDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingBomItem ? "Edit BOM Component" : "Add BOM Component"}
              </DialogTitle>
              <DialogDescription>
                {editingBomItem
                  ? "Update the component details below"
                  : "Select a supplier and item to add to the BOM"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="bom-supplier">Supplier *</Label>
                <Select
                  value={bomFormData.supplierId}
                  onValueChange={(value) => {
                    setBomFormData({ ...bomFormData, supplierId: value, supplierItemId: "" });
                    setSelectedSupplierId(value);
                  }}
                  disabled={!!editingBomItem}
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
                <Label htmlFor="bom-item">Position (Supplier Item) *</Label>
                <Select
                  value={bomFormData.supplierItemId}
                  onValueChange={(value) =>
                    setBomFormData({ ...bomFormData, supplierItemId: value })
                  }
                  disabled={!selectedSupplierId && !editingBomItem}
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
                  <Label htmlFor="bom-quantity">Quantity *</Label>
                  <Input
                    id="bom-quantity"
                    type="number"
                    step="0.01"
                    value={bomFormData.quantity}
                    onChange={(e) =>
                      setBomFormData({ ...bomFormData, quantity: e.target.value })
                    }
                    placeholder="1"
                  />
                </div>
                <div>
                  <Label htmlFor="bom-unit">Unit *</Label>
                  <Input
                    id="bom-unit"
                    value={bomFormData.unit}
                    onChange={(e) =>
                      setBomFormData({ ...bomFormData, unit: e.target.value })
                    }
                    placeholder="pcs, ml, kg"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="bom-wastage">Wastage / Reserve (%)</Label>
                <Input
                  id="bom-wastage"
                  type="number"
                  step="0.01"
                  value={bomFormData.wastagePercent}
                  onChange={(e) =>
                    setBomFormData({ ...bomFormData, wastagePercent: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bom-optional"
                  checked={bomFormData.isOptional}
                  onCheckedChange={(checked) =>
                    setBomFormData({ ...bomFormData, isOptional: checked === true })
                  }
                />
                <Label htmlFor="bom-optional" className="cursor-pointer">
                  Optional component
                </Label>
              </div>
              <div>
                <Label htmlFor="bom-note">Note / Comment</Label>
                <Textarea
                  id="bom-note"
                  value={bomFormData.note}
                  onChange={(e) =>
                    setBomFormData({ ...bomFormData, note: e.target.value })
                  }
                  placeholder="Additional notes about this component"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBomDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveBomItem} disabled={saving}>
                {saving ? "Saving..." : editingBomItem ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
