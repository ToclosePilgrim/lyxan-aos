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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";

interface Supplier {
  id: string;
  name: string;
  code: string | null;
  types: string[];
  status: string;
  country: {
    id: string;
    name: string;
    code: string;
  } | null;
  suppliesWhat: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  legalName: string | null;
  taxId: string | null;
  registrationNumber: string | null;
  legalAddress: string | null;
  bankDetails: string | null;
  bankAccount: string | null;
  corrAccount: string | null;
  bik: string | null;
  bankName: string | null;
  extraPaymentDetails: string | null;
  edoSystem: string | null;
  edoNumber: string | null;
  ceoFullName: string | null;
  tags: string[] | null;
  notes: string | null;
  legalProfiles?: Array<{
    id: string;
    countryCode: string;
    inn: string | null;
    kpp: string | null;
    ogrn: string | null;
    legalAddress: string | null;
    actualAddress: string | null;
    bankAccount: string | null;
    bankName: string | null;
    bankBic: string | null;
    bankCorrAccount: string | null;
    edoType: string | null;
    edoNumber: string | null;
    generalDirector: string | null;
  }>;
  scmProductLinks: Array<{
    id: string;
    role: string;
    leadTimeDays: number | null;
    minOrderQty: number | null;
    scmProduct: {
      id: string;
      internalName: string;
      sku: string | null;
      brand: {
        id: string;
        name: string;
        code: string;
      } | null;
    };
  }>;
}

interface Country {
  id: string;
  name: string;
  code: string;
}

interface ScmProduct {
  id: string;
  internalName: string;
  sku: string | null;
  brand: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface SupplierItem {
  id: string;
  name: string;
  code: string;
  type: "MATERIAL" | "SERVICE";
  category: string;
  unit: string;
  isActive: boolean;
  description: string | null;
  notes: string | null;
  sku: string | null;
  currency: string | null;
  price: number | null;
  minOrderQty: number | null;
  leadTimeDays: number | null;
  createdAt: string;
  updatedAt: string;
}

interface SupplierService {
  id: string;
  name: string;
  code: string | null;
  category: "PRODUCTION" | "LOGISTICS" | "OTHER";
  unit: string;
  basePrice: number | null;
  currency: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const SUPPLIER_TYPES = [
  { value: "MANUFACTURER", label: "Manufacturer" },
  { value: "COMPONENT_SUPPLIER", label: "Component Supplier" },
  { value: "PACKAGING_SUPPLIER", label: "Packaging Supplier" },
  { value: "PRINTING_HOUSE", label: "Printing House" },
  { value: "OTHER", label: "Other" },
] as const;

const SUPPLIER_STATUSES = ["ACTIVE", "INACTIVE", "ONBOARDING"] as const;

import { SupplierRole } from '@aos/shared';

const SUPPLIER_ROLES = [
  { value: SupplierRole.PRODUCER, label: "Producer (Производитель)" },
  { value: SupplierRole.RAW_MATERIAL, label: "Raw Material (Сырьё)" },
  { value: SupplierRole.PACKAGING, label: "Packaging (Упаковка)" },
  { value: SupplierRole.PRINTING, label: "Printing (Печать / полиграфия)" },
  { value: SupplierRole.LOGISTICS, label: "Logistics (Логистика)" },
  { value: SupplierRole.OTHER, label: "Other" },
] as const;

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supplierId = params.id as string;
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [scmProducts, setScmProducts] = useState<ScmProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linking, setLinking] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  
  // Supplier Items state
  const [items, setItems] = useState<SupplierItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SupplierItem | null>(null);
  const [itemTypeFilter, setItemTypeFilter] = useState<"ALL" | "MATERIAL">("ALL");
  const [showInactiveItems, setShowInactiveItems] = useState(false);
  
  // Supplier Services state
  const [services, setServices] = useState<SupplierService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<SupplierService | null>(null);
  const [showInactiveServices, setShowInactiveServices] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    types: ["MANUFACTURER"] as string[],
    status: "ACTIVE" as string,
    countryId: undefined as string | undefined,
    suppliesWhat: "",
    contactPerson: "",
    email: "",
    phone: "",
    website: "",
    legalName: "",
    taxId: "",
    registrationNumber: "",
    legalAddress: "",
    bankDetails: "",
    bankAccount: "",
    corrAccount: "",
    bik: "",
    bankName: "",
    extraPaymentDetails: "",
    edoSystem: "",
    edoNumber: "",
    ceoFullName: "",
    tags: "",
    notes: "",
    legalProfile: {
      countryCode: "RU",
      inn: "",
      kpp: "",
      ogrn: "",
      legalAddress: "",
      actualAddress: "",
      bankAccount: "",
      bankName: "",
      bankBic: "",
      bankCorrAccount: "",
      edoType: "",
      edoNumber: "",
      generalDirector: "",
    },
  });

  const [linkFormData, setLinkFormData] = useState<{
    scmProductId: string;
    role: SupplierRole;
    leadTimeDays: string;
    minOrderQty: string;
  }>({
    scmProductId: "",
    role: SupplierRole.PRODUCER,
    leadTimeDays: "",
    minOrderQty: "",
  });

  const [itemFormData, setItemFormData] = useState({
    name: "",
    code: "",
    type: "MATERIAL" as "MATERIAL" | "SERVICE",
    category: "OTHER" as string,
    unit: "",
    description: "",
    notes: "",
    sku: "",
    currency: "",
    price: "",
    minOrderQty: "",
    leadTimeDays: "",
    isActive: true,
  });

  const [serviceFormData, setServiceFormData] = useState({
    name: "",
    code: "",
    category: "OTHER" as "PRODUCTION" | "LOGISTICS" | "OTHER",
    unit: "",
    basePrice: "",
    currency: "",
    notes: "",
    isActive: true,
  });

  useEffect(() => {
    if (supplierId) {
      loadSupplier();
      loadCountries();
      loadScmProducts();
      loadItems();
      loadServices();
    }
  }, [supplierId]);

  useEffect(() => {
    if (supplierId) {
      loadItems();
    }
  }, [itemTypeFilter, showInactiveItems, supplierId]);

  useEffect(() => {
    if (supplierId) {
      loadServices();
    }
  }, [showInactiveServices, supplierId]);

  const loadSupplier = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<Supplier>(`/scm/suppliers/${supplierId}`);
      if (data) {
        // Ensure safe defaults for arrays and nested objects
        const safeData: Supplier = {
          ...data,
          scmProductLinks: Array.isArray(data.scmProductLinks) ? data.scmProductLinks : [],
          legalProfiles: Array.isArray(data.legalProfiles) ? data.legalProfiles : [],
          tags: Array.isArray(data.tags) ? data.tags : [],
        };
        setSupplier(safeData);
        const ruProfile = data.legalProfiles?.find((p) => p.countryCode === "RU");
        setFormData({
          name: data.name || "",
          code: data.code || "",
          types: data.types || [],
          status: data.status,
          countryId: data.country?.id,
          suppliesWhat: data.suppliesWhat || "",
          contactPerson: data.contactPerson || "",
          email: data.email || "",
          phone: data.phone || "",
          website: data.website || "",
          legalName: data.legalName || "",
          taxId: data.taxId || "",
          registrationNumber: data.registrationNumber || "",
          legalAddress: data.legalAddress || "",
          bankDetails: data.bankDetails || "",
          bankAccount: data.bankAccount || "",
          corrAccount: data.corrAccount || "",
          bik: data.bik || "",
          bankName: data.bankName || "",
          extraPaymentDetails: data.extraPaymentDetails || "",
          edoSystem: data.edoSystem || "",
          edoNumber: data.edoNumber || "",
          ceoFullName: data.ceoFullName || "",
          tags: Array.isArray(data.tags) ? data.tags.join(", ") : (data.tags || ""),
          notes: data.notes || "",
          legalProfile: {
            countryCode: "RU",
            inn: ruProfile?.inn || "",
            kpp: ruProfile?.kpp || "",
            ogrn: ruProfile?.ogrn || "",
            legalAddress: ruProfile?.legalAddress || "",
            actualAddress: ruProfile?.actualAddress || "",
            bankAccount: ruProfile?.bankAccount || "",
            bankName: ruProfile?.bankName || "",
            bankBic: ruProfile?.bankBic || "",
            bankCorrAccount: ruProfile?.bankCorrAccount || "",
            edoType: ruProfile?.edoType || "",
            edoNumber: ruProfile?.edoNumber || "",
            generalDirector: ruProfile?.generalDirector || "",
          },
        });
      }
    } catch (error) {
      console.error("Failed to load supplier:", error);
      toast.error("Failed to load supplier", {
        description: error instanceof Error ? error.message : "Supplier not found",
      });
      setTimeout(() => router.push("/scm/suppliers"), 2000);
    } finally {
      setLoading(false);
    }
  };

  const loadCountries = async () => {
    try {
      const data = await apiRequest<Country[]>("/org/countries");
      setCountries(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load countries:", error);
    }
  };

  const loadScmProducts = async () => {
    try {
      const data = await apiRequest<ScmProduct[]>("/scm/products");
      setScmProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load SCM products:", error);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      setSaving(true);
      const payload: any = {};

      if (formData.name !== supplier?.name) payload.name = formData.name;
      if (formData.code !== (supplier?.code || "")) payload.code = formData.code || null;
      if (JSON.stringify(formData.types) !== JSON.stringify(supplier?.types || [])) payload.types = formData.types;
      if (formData.status !== supplier?.status) payload.status = formData.status;
      if (formData.countryId !== (supplier?.country?.id || "")) {
        payload.countryId = formData.countryId || null;
      }
      if (formData.suppliesWhat !== (supplier?.suppliesWhat || "")) {
        payload.suppliesWhat = formData.suppliesWhat || null;
      }
      if (formData.contactPerson !== (supplier?.contactPerson || "")) {
        payload.contactPerson = formData.contactPerson || null;
      }
      if (formData.email !== (supplier?.email || "")) {
        payload.email = formData.email || null;
      }
      if (formData.phone !== (supplier?.phone || "")) {
        payload.phone = formData.phone || null;
      }
      if (formData.website !== (supplier?.website || "")) {
        payload.website = formData.website || null;
      }
      if (formData.legalName !== (supplier?.legalName || "")) {
        payload.legalName = formData.legalName || null;
      }
      if (formData.taxId !== (supplier?.taxId || "")) {
        payload.taxId = formData.taxId || null;
      }
      if (formData.registrationNumber !== (supplier?.registrationNumber || "")) {
        payload.registrationNumber = formData.registrationNumber || null;
      }
      if (formData.legalAddress !== (supplier?.legalAddress || "")) {
        payload.legalAddress = formData.legalAddress || null;
      }
      if (formData.bankDetails !== (supplier?.bankDetails || "")) {
        payload.bankDetails = formData.bankDetails || null;
      }
      if (formData.bankAccount !== (supplier?.bankAccount || "")) {
        payload.bankAccount = formData.bankAccount || null;
      }
      if (formData.corrAccount !== (supplier?.corrAccount || "")) {
        payload.corrAccount = formData.corrAccount || null;
      }
      if (formData.bik !== (supplier?.bik || "")) {
        payload.bik = formData.bik || null;
      }
      if (formData.bankName !== (supplier?.bankName || "")) {
        payload.bankName = formData.bankName || null;
      }
      if (formData.extraPaymentDetails !== (supplier?.extraPaymentDetails || "")) {
        payload.extraPaymentDetails = formData.extraPaymentDetails || null;
      }
      if (formData.edoSystem !== (supplier?.edoSystem || "")) {
        payload.edoSystem = formData.edoSystem || null;
      }
      if (formData.edoNumber !== (supplier?.edoNumber || "")) {
        payload.edoNumber = formData.edoNumber || null;
      }
      if (formData.ceoFullName !== (supplier?.ceoFullName || "")) {
        payload.ceoFullName = formData.ceoFullName || null;
      }
      const currentTags = Array.isArray(supplier?.tags) ? supplier.tags.join(", ") : (supplier?.tags || "");
      if (formData.tags !== currentTags) {
        payload.tags = formData.tags ? formData.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
      }
      if (formData.notes !== (supplier?.notes || "")) {
        payload.notes = formData.notes || null;
      }

      // Add Russian legal profile if country is RU
      const selectedCountry = countries.find((c) => c.id === formData.countryId);
      if (selectedCountry?.code === "RU") {
        const hasLegalData = Object.values(formData.legalProfile).some(
          (value) => value && value !== "RU" && value.trim() !== ""
        );
        if (hasLegalData) {
          payload.legalProfile = {
            countryCode: "RU",
            inn: formData.legalProfile.inn || undefined,
            kpp: formData.legalProfile.kpp || undefined,
            ogrn: formData.legalProfile.ogrn || undefined,
            legalAddress: formData.legalProfile.legalAddress || undefined,
            actualAddress: formData.legalProfile.actualAddress || undefined,
            bankAccount: formData.legalProfile.bankAccount || undefined,
            bankName: formData.legalProfile.bankName || undefined,
            bankBic: formData.legalProfile.bankBic || undefined,
            bankCorrAccount: formData.legalProfile.bankCorrAccount || undefined,
            edoType: formData.legalProfile.edoType || undefined,
            edoNumber: formData.legalProfile.edoNumber || undefined,
            generalDirector: formData.legalProfile.generalDirector || undefined,
          };
        }
      }

      await apiRequest(`/scm/suppliers/${supplierId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      toast.success("Supplier updated successfully");
      setIsEditing(false);
      await loadSupplier();
    } catch (error: any) {
      console.error("Failed to update supplier:", error);
      let errorMessage = "Failed to update supplier";
      
      if (error?.response?.data) {
        const errorData = error.response.data;
        if (errorData.message) {
          if (Array.isArray(errorData.message)) {
            // Validation errors from class-validator
            const validationErrors = errorData.message.map((err: any) => {
              const field = Object.keys(err.constraints || {})[0];
              return `${err.property}: ${err.constraints?.[field] || 'invalid'}`;
            }).join(', ');
            errorMessage = `Validation failed: ${validationErrors}`;
          } else if (typeof errorData.message === 'string') {
            errorMessage = errorData.message;
          } else if (errorData.message.message) {
            errorMessage = errorData.message.message;
          }
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleLinkProduct = async () => {
    if (!linkFormData.scmProductId) {
      toast.error("Please select a product");
      return;
    }

    try {
      setLinking(true);
      const payload: any = {
        scmProductId: linkFormData.scmProductId,
        role: linkFormData.role,
      };

      if (linkFormData.leadTimeDays) {
        payload.leadTimeDays = parseInt(linkFormData.leadTimeDays);
      }
      if (linkFormData.minOrderQty) {
        payload.minOrderQty = parseInt(linkFormData.minOrderQty);
      }

      await apiRequest(`/scm/suppliers/${supplierId}/link-product`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success("Product linked successfully");
      setLinkDialogOpen(false);
      setLinkFormData({
        scmProductId: "",
        role: SupplierRole.PRODUCER,
        leadTimeDays: "",
        minOrderQty: "",
      });
      await loadSupplier();
    } catch (error: any) {
      console.error("Failed to link product:", error);
      toast.error("Failed to link product", {
        description: error.message || "Unknown error",
      });
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkProduct = async (scmProductId: string) => {
    if (!confirm("Are you sure you want to unlink this product?")) {
      return;
    }

    try {
      await apiRequest(`/scm/suppliers/${supplierId}/link-product/${scmProductId}`, {
        method: "DELETE",
      });

      toast.success("Product unlinked successfully");
      await loadSupplier();
    } catch (error: any) {
      console.error("Failed to unlink product:", error);
      toast.error("Failed to unlink product", {
        description: error.message || "Unknown error",
      });
    }
  };

  const formatSupplierType = (typeValue: string) => {
    const type = SUPPLIER_TYPES.find((t) => t.value === typeValue);
    return type ? type.label : typeValue
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  };

  const formatSupplierTypes = (types: string[]) => {
    if (!types || types.length === 0) return "-";
    return types.map((t) => formatSupplierType(t)).join(", ");
  };

  const handleTypeToggle = (typeValue: string) => {
    const currentTypes = formData.types;
    if (currentTypes.includes(typeValue)) {
      // Remove type if already selected (but keep at least one)
      if (currentTypes.length > 1) {
        setFormData({
          ...formData,
          types: currentTypes.filter((t) => t !== typeValue),
        });
      } else {
        toast.error("At least one type must be selected");
      }
    } else {
      // Add type if not selected
      setFormData({
        ...formData,
        types: [...currentTypes, typeValue],
      });
    }
  };

  const loadItems = async () => {
    if (!supplierId) return;
    try {
      setItemsLoading(true);
      const params = new URLSearchParams();
      params.append("type", "MATERIAL"); // Only materials in items
      if (!showInactiveItems) {
        params.append("isActive", "true");
      }
      const queryString = params.toString();
      const url = `/scm/suppliers/${supplierId}/items${queryString ? `?${queryString}` : ""}`;
      const data = await apiRequest<SupplierItem[]>(url);
      setItems(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error("Failed to load items:", error);
      toast.error("Failed to load items", {
        description: error.message || "Unknown error",
      });
      setItems([]); // Fail-safe: set empty array on error
    } finally {
      setItemsLoading(false);
    }
  };

  const loadServices = async () => {
    if (!supplierId) return;
    try {
      setServicesLoading(true);
      const params = new URLSearchParams();
      if (!showInactiveServices) {
        params.append("isActive", "true");
      }
      const queryString = params.toString();
      const url = `/scm/suppliers/${supplierId}/services${queryString ? `?${queryString}` : ""}`;
      const data = await apiRequest<SupplierService[]>(url);
      setServices(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error("Failed to load services:", error);
      toast.error("Failed to load services", {
        description: error.message || "Unknown error",
      });
      setServices([]); // Fail-safe: set empty array on error
    } finally {
      setServicesLoading(false);
    }
  };

  const handleSaveItem = async () => {
    if (!itemFormData.name || !itemFormData.code || !itemFormData.category || !itemFormData.unit) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setSaving(true);
      const payload: any = {
        name: itemFormData.name,
        code: itemFormData.code,
        type: itemFormData.type,
        category: itemFormData.category,
        unit: itemFormData.unit,
        isActive: itemFormData.isActive,
      };

      if (itemFormData.description) payload.description = itemFormData.description;
      if (itemFormData.notes) payload.notes = itemFormData.notes;
      if (itemFormData.sku) payload.sku = itemFormData.sku;
      if (itemFormData.currency) payload.currency = itemFormData.currency;
      if (itemFormData.price) payload.price = parseFloat(itemFormData.price);
      if (itemFormData.minOrderQty) payload.minOrderQty = parseFloat(itemFormData.minOrderQty);
      if (itemFormData.leadTimeDays) payload.leadTimeDays = parseInt(itemFormData.leadTimeDays);

      if (editingItem) {
        await apiRequest(`/scm/suppliers/${supplierId}/items/${editingItem.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Item updated successfully");
      } else {
        await apiRequest(`/scm/suppliers/${supplierId}/items`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Item created successfully");
      }

      setItemDialogOpen(false);
      setEditingItem(null);
      setItemFormData({
        name: "",
        code: "",
        type: "MATERIAL",
        category: "OTHER",
        unit: "",
        description: "",
        notes: "",
        sku: "",
        currency: "",
        price: "",
        minOrderQty: "",
        leadTimeDays: "",
        isActive: true,
      });
      await loadItems();
    } catch (error: any) {
      console.error("Failed to save item:", error);
      toast.error("Failed to save item", {
        description: error.message || "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditItem = (item: SupplierItem) => {
    setEditingItem(item);
    setItemFormData({
      name: item.name,
      code: item.code,
      type: item.type,
      category: item.category,
      unit: item.unit,
      description: item.description || "",
      notes: item.notes || "",
      sku: item.sku || "",
      currency: item.currency || "",
      price: item.price?.toString() || "",
      minOrderQty: item.minOrderQty?.toString() || "",
      leadTimeDays: item.leadTimeDays?.toString() || "",
      isActive: item.isActive,
    });
    setItemDialogOpen(true);
  };

  const handleDeleteItem = async (item: SupplierItem) => {
    if (!confirm(`Are you sure you want to deactivate "${item.name}"?`)) {
      return;
    }

    try {
      await apiRequest(`/scm/suppliers/${supplierId}/items/${item.id}`, {
        method: "DELETE",
      });
      toast.success("Item deactivated successfully");
      await loadItems();
    } catch (error: any) {
      console.error("Failed to delete item:", error);
      toast.error("Failed to delete item", {
        description: error.message || "Unknown error",
      });
    }
  };

  const handleOpenNewItemDialog = () => {
    setEditingItem(null);
    setItemFormData({
      name: "",
      code: "",
      type: "MATERIAL",
      category: "OTHER",
      unit: "",
      description: "",
      notes: "",
      sku: "",
      currency: "",
      price: "",
      minOrderQty: "",
      leadTimeDays: "",
      isActive: true,
    });
    setItemDialogOpen(true);
  };

  const filteredProducts = scmProducts.filter(
    (p) =>
      !supplier?.scmProductLinks?.some((link) => link?.scmProduct?.id === p.id) &&
      (p.internalName.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase())))
  );

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-8">Loading...</div>
      </MainLayout>
    );
  }

  if (!supplier) {
    return (
      <MainLayout>
        <div className="text-center py-8 text-muted-foreground">
          Supplier not found
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
              <Link href="/scm/suppliers">← Back to list</Link>
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

        <Tabs defaultValue="details" className="space-y-4">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Supplier Details</CardTitle>
            <CardDescription>ID: {supplier.id}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                {isEditing ? (
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="col-span-3"
                    required
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{supplier.name}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="code" className="text-right">
                  Code
                </Label>
                {isEditing ? (
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="col-span-3"
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{supplier.code || "-"}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="types" className="text-right pt-2">
                  Types
                </Label>
                {isEditing ? (
                  <div className="col-span-3 space-y-3">
                    <p className="text-sm text-muted-foreground mb-2">
                      Types (you can choose several)
                    </p>
                    {SUPPLIER_TYPES.map((type) => (
                      <div key={type.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`type-${type.value}`}
                          checked={formData.types.includes(type.value)}
                          onCheckedChange={() => handleTypeToggle(type.value)}
                    disabled={saving}
                        />
                        <Label
                          htmlFor={`type-${type.value}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {type.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="col-span-3">{formatSupplierTypes(supplier.types)}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">
                  Status
                </Label>
                {isEditing ? (
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                    disabled={saving}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPLIER_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="col-span-3">{supplier.status}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="country" className="text-right">
                  Country
                </Label>
                {isEditing ? (
                  <Select
                    value={formData.countryId}
                    onValueChange={(value) => setFormData({ ...formData, countryId: value })}
                    disabled={saving}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select a country (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {(countries || []).map((country) => (
                        <SelectItem key={country.id} value={country.id}>
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="col-span-3">{supplier.country?.name || "-"}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="suppliesWhat" className="text-right pt-2">
                  Supplies what
                </Label>
                {isEditing ? (
                  <Textarea
                    id="suppliesWhat"
                    value={formData.suppliesWhat}
                    onChange={(e) =>
                      setFormData({ ...formData, suppliesWhat: e.target.value })
                    }
                    className="col-span-3"
                    rows={3}
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{supplier.suppliesWhat || "-"}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="contactPerson" className="text-right">
                  Contact Person
                </Label>
                {isEditing ? (
                  <Input
                    id="contactPerson"
                    value={formData.contactPerson}
                    onChange={(e) =>
                      setFormData({ ...formData, contactPerson: e.target.value })
                    }
                    className="col-span-3"
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{supplier.contactPerson || "-"}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  Email
                </Label>
                {isEditing ? (
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="col-span-3"
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{supplier.email || "-"}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">
                  Phone
                </Label>
                {isEditing ? (
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="col-span-3"
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{supplier.phone || "-"}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="website" className="text-right">
                  Website
                </Label>
                {isEditing ? (
                  <Input
                    id="website"
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="col-span-3"
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">
                    {supplier.website ? (
                      <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {supplier.website}
                      </a>
                    ) : (
                      "-"
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="legalName" className="text-right">
                  Legal Name
                </Label>
                {isEditing ? (
                  <Input
                    id="legalName"
                    value={formData.legalName}
                    onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                    className="col-span-3"
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{supplier.legalName || "-"}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="taxId" className="text-right">
                  Tax ID
                </Label>
                {isEditing ? (
                  <Input
                    id="taxId"
                    value={formData.taxId}
                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                    className="col-span-3"
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{supplier.taxId || "-"}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="registrationNumber" className="text-right">
                  Registration Number
                </Label>
                {isEditing ? (
                  <Input
                    id="registrationNumber"
                    value={formData.registrationNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, registrationNumber: e.target.value })
                    }
                    className="col-span-3"
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{supplier.registrationNumber || "-"}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="legalAddress" className="text-right pt-2">
                  Legal Address
                </Label>
                {isEditing ? (
                  <Textarea
                    id="legalAddress"
                    value={formData.legalAddress}
                    onChange={(e) =>
                      setFormData({ ...formData, legalAddress: e.target.value })
                    }
                    className="col-span-3"
                    rows={3}
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{supplier.legalAddress || "-"}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="bankDetails" className="text-right pt-2">
                  Bank Details (Legacy)
                </Label>
                {isEditing ? (
                  <Textarea
                    id="bankDetails"
                    value={formData.bankDetails}
                    onChange={(e) =>
                      setFormData({ ...formData, bankDetails: e.target.value })
                    }
                    className="col-span-3"
                    rows={3}
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{supplier.bankDetails || "-"}</div>
                )}
              </div>

              {/* Банковские реквизиты */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="bankAccount" className="text-right">
                  Bank Account
                </Label>
                {isEditing ? (
                  <Input
                    id="bankAccount"
                    value={formData.bankAccount}
                    onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                    className="col-span-3"
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{supplier.bankAccount || "-"}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="corrAccount" className="text-right">
                  Corr. Account
                </Label>
                {isEditing ? (
                  <Input
                    id="corrAccount"
                    value={formData.corrAccount}
                    onChange={(e) => setFormData({ ...formData, corrAccount: e.target.value })}
                    className="col-span-3"
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{supplier.corrAccount || "-"}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="bik" className="text-right">
                  BIC
                </Label>
                {isEditing ? (
                  <Input
                    id="bik"
                    value={formData.bik}
                    onChange={(e) => setFormData({ ...formData, bik: e.target.value })}
                    className="col-span-3"
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{supplier.bik || "-"}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="bankName" className="text-right">
                  Bank Name
                </Label>
                {isEditing ? (
                  <Input
                    id="bankName"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="col-span-3"
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{supplier.bankName || "-"}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="extraPaymentDetails" className="text-right pt-2">
                  Extra Payment Details
                </Label>
                {isEditing ? (
                  <Textarea
                    id="extraPaymentDetails"
                    value={formData.extraPaymentDetails}
                    onChange={(e) =>
                      setFormData({ ...formData, extraPaymentDetails: e.target.value })
                    }
                    className="col-span-3"
                    rows={3}
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{supplier.extraPaymentDetails || "-"}</div>
                )}
              </div>

              {/* ЭДО и доп. инфо */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edoSystem" className="text-right">
                  EDO System
                </Label>
                {isEditing ? (
                  <Input
                    id="edoSystem"
                    value={formData.edoSystem}
                    onChange={(e) => setFormData({ ...formData, edoSystem: e.target.value })}
                    className="col-span-3"
                    disabled={saving}
                    placeholder="e.g., Тензор СБИС"
                  />
                ) : (
                  <div className="col-span-3">{supplier.edoSystem || "-"}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edoNumber" className="text-right">
                  EDO Number
                </Label>
                {isEditing ? (
                  <Input
                    id="edoNumber"
                    value={formData.edoNumber}
                    onChange={(e) => setFormData({ ...formData, edoNumber: e.target.value })}
                    className="col-span-3"
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{supplier.edoNumber || "-"}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="ceoFullName" className="text-right">
                  CEO Full Name
                </Label>
                {isEditing ? (
                  <Input
                    id="ceoFullName"
                    value={formData.ceoFullName}
                    onChange={(e) => setFormData({ ...formData, ceoFullName: e.target.value })}
                    className="col-span-3"
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{supplier.ceoFullName || "-"}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="tags" className="text-right">
                  Tags
                </Label>
                {isEditing ? (
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="col-span-3"
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{supplier.tags || "-"}</div>
                )}
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="notes" className="text-right pt-2">
                  Notes
                </Label>
                {isEditing ? (
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="col-span-3"
                    rows={4}
                    disabled={saving}
                  />
                ) : (
                  <div className="col-span-3">{supplier.notes || "-"}</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {(() => {
          const selectedCountry = countries.find((c) => c.id === formData.countryId);
          const isRussia = selectedCountry?.code === "RU" || supplier?.country?.code === "RU";
          return isRussia ? (
            <Card>
              <CardHeader>
                <CardTitle>Russian Legal Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="inn" className="text-right">
                      INN
                    </Label>
                    {isEditing ? (
                      <Input
                        id="inn"
                        value={formData.legalProfile.inn}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            legalProfile: { ...formData.legalProfile, inn: e.target.value },
                          })
                        }
                        className="col-span-3"
                        disabled={saving}
                      />
                    ) : (
                      <div className="col-span-3">
                        {supplier?.legalProfiles?.find((p) => p.countryCode === "RU")?.inn || "-"}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="kpp" className="text-right">
                      KPP
                    </Label>
                    {isEditing ? (
                      <Input
                        id="kpp"
                        value={formData.legalProfile.kpp}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            legalProfile: { ...formData.legalProfile, kpp: e.target.value },
                          })
                        }
                        className="col-span-3"
                        disabled={saving}
                      />
                    ) : (
                      <div className="col-span-3">
                        {supplier?.legalProfiles?.find((p) => p.countryCode === "RU")?.kpp || "-"}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="ogrn" className="text-right">
                      OGRN
                    </Label>
                    {isEditing ? (
                      <Input
                        id="ogrn"
                        value={formData.legalProfile.ogrn}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            legalProfile: { ...formData.legalProfile, ogrn: e.target.value },
                          })
                        }
                        className="col-span-3"
                        disabled={saving}
                      />
                    ) : (
                      <div className="col-span-3">
                        {supplier?.legalProfiles?.find((p) => p.countryCode === "RU")?.ogrn || "-"}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="legalAddressRu" className="text-right pt-2">
                      Legal Address
                    </Label>
                    {isEditing ? (
                      <Textarea
                        id="legalAddressRu"
                        value={formData.legalProfile.legalAddress}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            legalProfile: { ...formData.legalProfile, legalAddress: e.target.value },
                          })
                        }
                        className="col-span-3"
                        rows={3}
                        disabled={saving}
                      />
                    ) : (
                      <div className="col-span-3">
                        {supplier?.legalProfiles?.find((p) => p.countryCode === "RU")?.legalAddress || "-"}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="actualAddress" className="text-right pt-2">
                      Actual Address
                    </Label>
                    {isEditing ? (
                      <Textarea
                        id="actualAddress"
                        value={formData.legalProfile.actualAddress}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            legalProfile: { ...formData.legalProfile, actualAddress: e.target.value },
                          })
                        }
                        className="col-span-3"
                        rows={3}
                        disabled={saving}
                      />
                    ) : (
                      <div className="col-span-3">
                        {supplier?.legalProfiles?.find((p) => p.countryCode === "RU")?.actualAddress || "-"}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="bankAccount" className="text-right">
                      Bank Account
                    </Label>
                    {isEditing ? (
                      <Input
                        id="bankAccount"
                        value={formData.legalProfile.bankAccount}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            legalProfile: { ...formData.legalProfile, bankAccount: e.target.value },
                          })
                        }
                        className="col-span-3"
                        disabled={saving}
                      />
                    ) : (
                      <div className="col-span-3">
                        {supplier?.legalProfiles?.find((p) => p.countryCode === "RU")?.bankAccount || "-"}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="bankName" className="text-right">
                      Bank Name
                    </Label>
                    {isEditing ? (
                      <Input
                        id="bankName"
                        value={formData.legalProfile.bankName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            legalProfile: { ...formData.legalProfile, bankName: e.target.value },
                          })
                        }
                        className="col-span-3"
                        disabled={saving}
                      />
                    ) : (
                      <div className="col-span-3">
                        {supplier?.legalProfiles?.find((p) => p.countryCode === "RU")?.bankName || "-"}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="bankBic" className="text-right">
                      BIC
                    </Label>
                    {isEditing ? (
                      <Input
                        id="bankBic"
                        value={formData.legalProfile.bankBic}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            legalProfile: { ...formData.legalProfile, bankBic: e.target.value },
                          })
                        }
                        className="col-span-3"
                        disabled={saving}
                      />
                    ) : (
                      <div className="col-span-3">
                        {supplier?.legalProfiles?.find((p) => p.countryCode === "RU")?.bankBic || "-"}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="bankCorrAccount" className="text-right">
                      Corr. Account
                    </Label>
                    {isEditing ? (
                      <Input
                        id="bankCorrAccount"
                        value={formData.legalProfile.bankCorrAccount}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            legalProfile: { ...formData.legalProfile, bankCorrAccount: e.target.value },
                          })
                        }
                        className="col-span-3"
                        disabled={saving}
                      />
                    ) : (
                      <div className="col-span-3">
                        {supplier?.legalProfiles?.find((p) => p.countryCode === "RU")?.bankCorrAccount || "-"}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edoType" className="text-right">
                      EDI Type
                    </Label>
                    {isEditing ? (
                      <Input
                        id="edoType"
                        value={formData.legalProfile.edoType}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            legalProfile: { ...formData.legalProfile, edoType: e.target.value },
                          })
                        }
                        className="col-span-3"
                        placeholder="e.g., СБИС, Диадок"
                        disabled={saving}
                      />
                    ) : (
                      <div className="col-span-3">
                        {supplier?.legalProfiles?.find((p) => p.countryCode === "RU")?.edoType || "-"}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edoNumber" className="text-right">
                      EDI Number
                    </Label>
                    {isEditing ? (
                      <Input
                        id="edoNumber"
                        value={formData.legalProfile.edoNumber}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            legalProfile: { ...formData.legalProfile, edoNumber: e.target.value },
                          })
                        }
                        className="col-span-3"
                        disabled={saving}
                      />
                    ) : (
                      <div className="col-span-3">
                        {supplier?.legalProfiles?.find((p) => p.countryCode === "RU")?.edoNumber || "-"}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="generalDirector" className="text-right">
                      General Director
                    </Label>
                    {isEditing ? (
                      <Input
                        id="generalDirector"
                        value={formData.legalProfile.generalDirector}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            legalProfile: { ...formData.legalProfile, generalDirector: e.target.value },
                          })
                        }
                        className="col-span-3"
                        disabled={saving}
                      />
                    ) : (
                      <div className="col-span-3">
                        {supplier?.legalProfiles?.find((p) => p.countryCode === "RU")?.generalDirector || "-"}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null;
        })()}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Linked SCM Products</CardTitle>
                <CardDescription>
                  {supplier?.scmProductLinks?.length || 0} product(s) linked
                </CardDescription>
              </div>
              <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
                <DialogTrigger asChild>
                  <Button>Link Product</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Link SCM Product</DialogTitle>
                    <DialogDescription>
                      Select a product to link to this supplier
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="productSearch">Search Product</Label>
                      <Input
                        id="productSearch"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Search by name or SKU"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="scmProduct">SCM Product *</Label>
                      <Select
                        value={linkFormData.scmProductId}
                        onValueChange={(value) =>
                          setLinkFormData({ ...linkFormData, scmProductId: value })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select a product" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredProducts.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.internalName} {product.sku && `(${product.sku})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="role">Role *</Label>
                      <Select
                        value={linkFormData.role}
                        onValueChange={(value) =>
                          setLinkFormData({ ...linkFormData, role: value as SupplierRole })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPLIER_ROLES.map((roleOption) => (
                            <SelectItem key={roleOption.value} value={roleOption.value}>
                              {roleOption.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="leadTimeDays">Lead Time (days)</Label>
                      <Input
                        id="leadTimeDays"
                        type="number"
                        value={linkFormData.leadTimeDays}
                        onChange={(e) =>
                          setLinkFormData({ ...linkFormData, leadTimeDays: e.target.value })
                        }
                        className="mt-1"
                        min="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="minOrderQty">Min Order Qty</Label>
                      <Input
                        id="minOrderQty"
                        type="number"
                        value={linkFormData.minOrderQty}
                        onChange={(e) =>
                          setLinkFormData({ ...linkFormData, minOrderQty: e.target.value })
                        }
                        className="mt-1"
                        min="0"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleLinkProduct} disabled={linking}>
                      {linking ? "Linking..." : "Link"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {supplier.scmProductLinks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No products linked to this supplier
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Lead Time (days)</TableHead>
                    <TableHead>Min Order Qty</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.scmProductLinks
                    .filter((link) => link?.id && link?.scmProduct?.id)
                    .map((link) => (
                      <TableRow key={link.id}>
                        <TableCell>
                          {link.scmProduct?.id ? (
                            <Link
                              href={`/scm/products/${link.scmProduct.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              {link.scmProduct?.internalName || "Unknown Product"}
                            </Link>
                          ) : (
                            <span>Unknown Product</span>
                          )}
                          {link.scmProduct?.sku && (
                            <span className="text-muted-foreground ml-2">
                              ({link.scmProduct.sku})
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{link.role || "-"}</TableCell>
                        <TableCell>{link.leadTimeDays || "-"}</TableCell>
                        <TableCell>{link.minOrderQty || "-"}</TableCell>
                        <TableCell className="text-right">
                          {link.scmProduct?.id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnlinkProduct(link.scmProduct.id)}
                            >
                              Unlink
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="catalog" className="space-y-4">
            {/* Items Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Items (Materials & Components)</CardTitle>
                    <CardDescription>
                      Manage material items for this supplier
                    </CardDescription>
                  </div>
                  <Button onClick={handleOpenNewItemDialog}>Add Item</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="showInactiveItems"
                        checked={showInactiveItems}
                        onCheckedChange={(checked) => setShowInactiveItems(checked === true)}
                      />
                      <Label htmlFor="showInactiveItems" className="cursor-pointer">
                        Show inactive
                      </Label>
                    </div>
                  </div>

                  {itemsLoading ? (
                    <div className="text-center py-8">Loading items...</div>
                  ) : items.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No items found. Click "Add Item" to create one.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Min Order</TableHead>
                          <TableHead>Lead Time</TableHead>
                          <TableHead>Active</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.code}</TableCell>
                            <TableCell>{item.category}</TableCell>
                            <TableCell>{item.unit}</TableCell>
                            <TableCell>
                              {item.price !== null && item.price !== undefined
                                ? `${item.price} ${item.currency || ""}`
                                : "-"}
                            </TableCell>
                            <TableCell>{item.minOrderQty || "-"}</TableCell>
                            <TableCell>
                              {item.leadTimeDays !== null && item.leadTimeDays !== undefined
                                ? `${item.leadTimeDays} days`
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {item.isActive ? (
                                <span className="text-green-600">Yes</span>
                              ) : (
                                <span className="text-gray-400">No</span>
                              )}
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
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Services Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Services</CardTitle>
                    <CardDescription>
                      Manage services provided by this supplier
                    </CardDescription>
                  </div>
                  <Button onClick={() => {
                    setEditingService(null);
                    setServiceFormData({
                      name: "",
                      code: "",
                      category: "OTHER",
                      unit: "",
                      basePrice: "",
                      currency: "",
                      notes: "",
                      isActive: true,
                    });
                    setServiceDialogOpen(true);
                  }}>Add Service</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="showInactiveServices"
                        checked={showInactiveServices}
                        onCheckedChange={(checked) => setShowInactiveServices(checked === true)}
                      />
                      <Label htmlFor="showInactiveServices" className="cursor-pointer">
                        Show inactive
                      </Label>
                    </div>
                  </div>

                  {servicesLoading ? (
                    <div className="text-center py-8">Loading services...</div>
                  ) : services.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No services found. Click "Add Service" to create one.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead>Base Price</TableHead>
                          <TableHead>Active</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {services.map((service) => (
                          <TableRow key={service.id}>
                            <TableCell className="font-medium">{service.name}</TableCell>
                            <TableCell>{service.code || "-"}</TableCell>
                            <TableCell>{service.category}</TableCell>
                            <TableCell>{service.unit}</TableCell>
                            <TableCell>
                              {service.basePrice !== null && service.basePrice !== undefined
                                ? `${service.basePrice} ${service.currency || ""}`
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {service.isActive ? (
                                <span className="text-green-600">Yes</span>
                              ) : (
                                <span className="text-gray-400">No</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingService(service);
                                    setServiceFormData({
                                      name: service.name,
                                      code: service.code || "",
                                      category: service.category,
                                      unit: service.unit,
                                      basePrice: service.basePrice?.toString() || "",
                                      currency: service.currency || "",
                                      notes: service.notes || "",
                                      isActive: service.isActive,
                                    });
                                    setServiceDialogOpen(true);
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    if (!confirm(`Are you sure you want to deactivate "${service.name}"?`)) {
                                      return;
                                    }
                                    try {
                                      await apiRequest(`/scm/suppliers/${supplierId}/services/${service.id}`, {
                                        method: "DELETE",
                                      });
                                      toast.success("Service deactivated successfully");
                                      await loadServices();
                                    } catch (error: any) {
                                      console.error("Failed to delete service:", error);
                                      toast.error("Failed to delete service", {
                                        description: error.message || "Unknown error",
                                      });
                                    }
                                  }}
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="items" className="space-y-4" style={{ display: 'none' }}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Supplier Items</CardTitle>
                    <CardDescription>
                      Manage items (materials and services) for this supplier
                    </CardDescription>
                  </div>
                  <Button onClick={handleOpenNewItemDialog}>Add Item</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="showInactive"
                        checked={showInactiveItems}
                        onCheckedChange={(checked) => setShowInactiveItems(checked === true)}
                      />
                      <Label htmlFor="showInactive" className="cursor-pointer">
                        Show inactive
                      </Label>
                    </div>
                  </div>

                  {itemsLoading ? (
                    <div className="text-center py-8">Loading items...</div>
                  ) : items.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No items found. Click "Add Item" to create one.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Min Order</TableHead>
                          <TableHead>Lead Time</TableHead>
                          <TableHead>Active</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.code}</TableCell>
                            <TableCell>{item.type}</TableCell>
                            <TableCell>{item.category}</TableCell>
                            <TableCell>{item.unit}</TableCell>
                            <TableCell>
                              {item.price !== null && item.price !== undefined
                                ? `${item.price} ${item.currency || ""}`
                                : "-"}
                            </TableCell>
                            <TableCell>{item.minOrderQty || "-"}</TableCell>
                            <TableCell>
                              {item.leadTimeDays !== null && item.leadTimeDays !== undefined
                                ? `${item.leadTimeDays} days`
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {item.isActive ? (
                                <span className="text-green-600">Yes</span>
                              ) : (
                                <span className="text-gray-400">No</span>
                              )}
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
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Item Dialog */}
        <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? "Edit Item" : "Create New Item"}
              </DialogTitle>
              <DialogDescription>
                {editingItem
                  ? "Update the item details below"
                  : "Fill in the details to create a new supplier item"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="item-category">Category *</Label>
                  <Select
                    value={itemFormData.category}
                    onValueChange={(value) =>
                      setItemFormData({ ...itemFormData, category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RAW_MATERIAL">Raw Material</SelectItem>
                      <SelectItem value="PACKAGING">Packaging</SelectItem>
                      <SelectItem value="LABEL">Label</SelectItem>
                      <SelectItem value="BOX">Box</SelectItem>
                      <SelectItem value="SHIPPING_BOX">Shipping Box</SelectItem>
                      <SelectItem value="PRINTING">Printing</SelectItem>
                      <SelectItem value="MANUFACTURING">Manufacturing</SelectItem>
                      <SelectItem value="LOGISTICS">Logistics</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="item-name">Name *</Label>
                <Input
                  id="item-name"
                  value={itemFormData.name}
                  onChange={(e) =>
                    setItemFormData({ ...itemFormData, name: e.target.value })
                  }
                  placeholder="e.g., Glass bottle 30ml"
                />
              </div>
              <div>
                <Label htmlFor="item-code">Code *</Label>
                <Input
                  id="item-code"
                  value={itemFormData.code}
                  onChange={(e) =>
                    setItemFormData({ ...itemFormData, code: e.target.value })
                  }
                  placeholder="e.g., BOTTLE-30ML"
                />
              </div>
              <div>
                <Label htmlFor="item-unit">Unit *</Label>
                <Input
                  id="item-unit"
                  value={itemFormData.unit}
                  onChange={(e) =>
                    setItemFormData({ ...itemFormData, unit: e.target.value })
                  }
                  placeholder="e.g., pcs, kg, l"
                />
              </div>
              <div>
                <Label htmlFor="item-description">Description</Label>
                <Textarea
                  id="item-description"
                  value={itemFormData.description}
                  onChange={(e) =>
                    setItemFormData({ ...itemFormData, description: e.target.value })
                  }
                  placeholder="Brief description of the item"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="item-notes">Notes</Label>
                <Textarea
                  id="item-notes"
                  value={itemFormData.notes}
                  onChange={(e) =>
                    setItemFormData({ ...itemFormData, notes: e.target.value })
                  }
                  placeholder="Additional notes"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="item-sku">SKU</Label>
                <Input
                  id="item-sku"
                  value={itemFormData.sku}
                  onChange={(e) =>
                    setItemFormData({ ...itemFormData, sku: e.target.value })
                  }
                  placeholder="Supplier's SKU code"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="item-currency">Currency</Label>
                  <Input
                    id="item-currency"
                    value={itemFormData.currency}
                    onChange={(e) =>
                      setItemFormData({ ...itemFormData, currency: e.target.value })
                    }
                    placeholder="e.g., RUB, USD"
                  />
                </div>
                <div>
                  <Label htmlFor="item-price">Price</Label>
                  <Input
                    id="item-price"
                    type="number"
                    step="0.01"
                    value={itemFormData.price}
                    onChange={(e) =>
                      setItemFormData({ ...itemFormData, price: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="item-minOrderQty">Min Order Quantity</Label>
                  <Input
                    id="item-minOrderQty"
                    type="number"
                    step="0.01"
                    value={itemFormData.minOrderQty}
                    onChange={(e) =>
                      setItemFormData({ ...itemFormData, minOrderQty: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="item-leadTimeDays">Lead Time (days)</Label>
                  <Input
                    id="item-leadTimeDays"
                    type="number"
                    value={itemFormData.leadTimeDays}
                    onChange={(e) =>
                      setItemFormData({ ...itemFormData, leadTimeDays: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
              </div>
              {editingItem && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="item-isActive"
                    checked={itemFormData.isActive}
                    onCheckedChange={(checked) =>
                      setItemFormData({ ...itemFormData, isActive: checked === true })
                    }
                  />
                  <Label htmlFor="item-isActive" className="cursor-pointer">
                    Is Active
                  </Label>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setItemDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveItem} disabled={saving}>
                {saving ? "Saving..." : editingItem ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Service Dialog */}
        <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingService ? "Edit Service" : "Create New Service"}
              </DialogTitle>
              <DialogDescription>
                {editingService
                  ? "Update the service details below"
                  : "Fill in the details to create a new supplier service"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="service-name">Name *</Label>
                <Input
                  id="service-name"
                  value={serviceFormData.name}
                  onChange={(e) =>
                    setServiceFormData({ ...serviceFormData, name: e.target.value })
                  }
                  placeholder="e.g., Label application"
                />
              </div>
              <div>
                <Label htmlFor="service-code">Code</Label>
                <Input
                  id="service-code"
                  value={serviceFormData.code}
                  onChange={(e) =>
                    setServiceFormData({ ...serviceFormData, code: e.target.value })
                  }
                  placeholder="e.g., LABEL-APP"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="service-category">Category *</Label>
                  <Select
                    value={serviceFormData.category}
                    onValueChange={(value: "PRODUCTION" | "LOGISTICS" | "OTHER") =>
                      setServiceFormData({ ...serviceFormData, category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRODUCTION">Production</SelectItem>
                      <SelectItem value="LOGISTICS">Logistics</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="service-unit">Unit *</Label>
                  <Input
                    id="service-unit"
                    value={serviceFormData.unit}
                    onChange={(e) =>
                      setServiceFormData({ ...serviceFormData, unit: e.target.value })
                    }
                    placeholder="e.g., pcs, hour"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="service-basePrice">Base Price</Label>
                  <Input
                    id="service-basePrice"
                    type="number"
                    step="0.01"
                    value={serviceFormData.basePrice}
                    onChange={(e) =>
                      setServiceFormData({ ...serviceFormData, basePrice: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="service-currency">Currency</Label>
                  <Input
                    id="service-currency"
                    value={serviceFormData.currency}
                    onChange={(e) =>
                      setServiceFormData({ ...serviceFormData, currency: e.target.value })
                    }
                    placeholder="e.g., RUB, USD"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="service-notes">Notes</Label>
                <Textarea
                  id="service-notes"
                  value={serviceFormData.notes}
                  onChange={(e) =>
                    setServiceFormData({ ...serviceFormData, notes: e.target.value })
                  }
                  placeholder="Additional notes"
                  rows={3}
                />
              </div>
              {editingService && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="service-isActive"
                    checked={serviceFormData.isActive}
                    onCheckedChange={(checked) =>
                      setServiceFormData({ ...serviceFormData, isActive: checked === true })
                    }
                  />
                  <Label htmlFor="service-isActive" className="cursor-pointer">
                    Is Active
                  </Label>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setServiceDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!serviceFormData.name || !serviceFormData.unit) {
                    toast.error("Please fill in all required fields");
                    return;
                  }
                  try {
                    setSaving(true);
                    const payload: any = {
                      name: serviceFormData.name,
                      code: serviceFormData.code || undefined,
                      category: serviceFormData.category,
                      unit: serviceFormData.unit,
                    };
                    if (serviceFormData.basePrice) payload.basePrice = parseFloat(serviceFormData.basePrice);
                    if (serviceFormData.currency) payload.currency = serviceFormData.currency;
                    if (serviceFormData.notes) payload.notes = serviceFormData.notes;
                    if (editingService) {
                      payload.isActive = serviceFormData.isActive;
                      await apiRequest(`/scm/suppliers/${supplierId}/services/${editingService.id}`, {
                        method: "PATCH",
                        body: JSON.stringify(payload),
                      });
                      toast.success("Service updated successfully");
                    } else {
                      await apiRequest(`/scm/suppliers/${supplierId}/services`, {
                        method: "POST",
                        body: JSON.stringify(payload),
                      });
                      toast.success("Service created successfully");
                    }
                    setServiceDialogOpen(false);
                    setEditingService(null);
                    setServiceFormData({
                      name: "",
                      code: "",
                      category: "OTHER",
                      unit: "",
                      basePrice: "",
                      currency: "",
                      notes: "",
                      isActive: true,
                    });
                    await loadServices();
                  } catch (error: any) {
                    console.error("Failed to save service:", error);
                    toast.error("Failed to save service", {
                      description: error.message || "Unknown error",
                    });
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
              >
                {saving ? "Saving..." : editingService ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

