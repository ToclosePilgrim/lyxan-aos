"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";

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

interface Brand {
  id: string;
  name: string;
  code: string;
}

interface Marketplace {
  id: string;
  name: string;
  code: string;
}

export default function CreateListingPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [scmProducts, setScmProducts] = useState<ScmProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scmProductSearch, setScmProductSearch] = useState("");
  const [loadingScmProducts, setLoadingScmProducts] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    brandId: undefined as string | undefined,
    scmProductId: undefined as string | undefined,
    marketplaceId: undefined as string | undefined,
    category: "",
    skuCode: "",
    skuName: "",
    price: "",
    cost: "",
    title: "",
    subtitle: "",
    shortDescription: "",
    fullDescription: "",
    keywords: "",
    mpTitle: "",
    mpSubtitle: "",
    mpShortDescription: "",
    mpDescription: "",
    aiContentEnabled: true,
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (scmProductSearch.trim().length > 0 || formData.brandId) {
      const timeoutId = setTimeout(() => {
        loadScmProducts();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setScmProducts([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scmProductSearch, formData.brandId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [brandsData, marketplacesData] = await Promise.all([
        apiRequest<Brand[]>("/bcm/brands"),
        apiRequest<Marketplace[]>("/org/marketplaces"),
      ]);
      setBrands(Array.isArray(brandsData) ? brandsData : []);
      setMarketplaces(Array.isArray(marketplacesData) ? marketplacesData : []);
    } catch (error) {
      console.error("Failed to load initial data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const loadScmProducts = async () => {
    if (!formData.brandId) {
      setScmProducts([]);
      return;
    }

    try {
      setLoadingScmProducts(true);
      const params = new URLSearchParams();
      if (scmProductSearch.trim()) {
        params.append("search", scmProductSearch.trim());
      }
      if (formData.brandId) {
        params.append("brandId", formData.brandId);
      }

      const query = params.toString();
      const endpoint = `/scm/products${query ? `?${query}` : ""}`;
      const data = await apiRequest<ScmProduct[]>(endpoint);
      setScmProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load SCM products:", error);
      toast.error("Failed to load SCM products", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      setScmProducts([]);
    } finally {
      setLoadingScmProducts(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Listing name is required");
      return;
    }

    if (!formData.brandId) {
      toast.error("Brand is required");
      return;
    }

    if (!formData.scmProductId) {
      toast.error("SCM Product is required");
      return;
    }

    if (!formData.skuCode.trim()) {
      toast.error("SKU code is required");
      return;
    }

    try {
      setSaving(true);
      const payload: {
        name: string;
        brandId: string;
        scmProductId: string;
        marketplaceId?: string;
        category?: string;
        skuCode: string;
        skuName?: string;
        price?: number;
        cost?: number;
        title?: string;
        subtitle?: string;
        shortDescription?: string;
        fullDescription?: string;
        keywords?: string;
        mpTitle?: string;
        mpSubtitle?: string;
        mpShortDescription?: string;
        mpDescription?: string;
        aiContentEnabled?: boolean;
      } = {
        name: formData.name,
        brandId: formData.brandId,
        scmProductId: formData.scmProductId,
        skuCode: formData.skuCode,
      };

      if (formData.marketplaceId && formData.marketplaceId !== "NONE") {
        payload.marketplaceId = formData.marketplaceId;
      }
      if (formData.category) payload.category = formData.category;
      if (formData.skuName) payload.skuName = formData.skuName;
      if (formData.price) payload.price = parseFloat(formData.price);
      if (formData.cost) payload.cost = parseFloat(formData.cost);
      if (formData.title) payload.title = formData.title;
      if (formData.subtitle) payload.subtitle = formData.subtitle;
      if (formData.shortDescription) payload.shortDescription = formData.shortDescription;
      if (formData.fullDescription) payload.fullDescription = formData.fullDescription;
      if (formData.keywords) payload.keywords = formData.keywords;
      if (formData.mpTitle) payload.mpTitle = formData.mpTitle;
      if (formData.mpSubtitle) payload.mpSubtitle = formData.mpSubtitle;
      if (formData.mpShortDescription) payload.mpShortDescription = formData.mpShortDescription;
      if (formData.mpDescription) payload.mpDescription = formData.mpDescription;
      if (formData.aiContentEnabled !== undefined) payload.aiContentEnabled = formData.aiContentEnabled;

      const newListing = await apiRequest<{ id: string }>("/bcm/products", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success("Listing created successfully");
      router.push(`/bcm/products/${newListing.id}`);
    } catch (error: any) {
      console.error("Failed to create listing:", error);
      const errorMessage =
        error.message || error.response?.data?.message || "Unknown error";
      
      if (errorMessage.includes("SCM product") || errorMessage.includes("scmProductId")) {
        toast.error("SCM Product error", {
          description: "The selected SCM Product is invalid. Please select another one.",
        });
        setFormData({ ...formData, scmProductId: undefined });
      } else {
        toast.error("Failed to create listing", {
          description: errorMessage,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const selectedScmProduct = (scmProducts || []).find((p) => p.id === formData.scmProductId);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create Listing</h1>
            <p className="text-muted-foreground mt-2">
              Create a new marketplace listing
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Listing Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="brand" className="text-right">
                  Brand *
                </Label>
                <Select
                  value={formData.brandId}
                  onValueChange={(value) => {
                    setFormData({ ...formData, brandId: value, scmProductId: undefined });
                    setScmProductSearch("");
                  }}
                  disabled={saving || loading}
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
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="scmProduct" className="text-right">
                  SCM Product *
                </Label>
                <div className="col-span-3 space-y-2">
                  <Input
                    id="scmProduct"
                    placeholder="Search SCM products by name or SKU..."
                    value={scmProductSearch}
                    onChange={(e) => setScmProductSearch(e.target.value)}
                    disabled={saving || !formData.brandId}
                    onFocus={() => {
                      if (formData.brandId && scmProducts.length === 0) {
                        loadScmProducts();
                      }
                    }}
                  />
                  {!formData.brandId && (
                    <p className="text-sm text-muted-foreground">
                      Please select a brand first
                    </p>
                  )}
                  {formData.brandId && (
                    <Select
                      value={formData.scmProductId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, scmProductId: value })
                      }
                      disabled={saving || loadingScmProducts}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select SCM Product" />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingScmProducts ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            Loading...
                          </div>
                        ) : scmProducts.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            {scmProductSearch.trim()
                              ? "No SCM products found"
                              : "Start typing to search"}
                          </div>
                        ) : (
                          (scmProducts || []).map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.brand?.name || ""} • {product.internalName}
                              {product.sku ? ` [${product.sku}]` : ""}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                  {selectedScmProduct && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {selectedScmProduct.internalName}
                      {selectedScmProduct.sku && ` (${selectedScmProduct.sku})`}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Listing Name *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="col-span-3"
                  required
                  disabled={saving}
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="marketplace" className="text-right">
                  Marketplace
                </Label>
                <Select
                  value={formData.marketplaceId || "NONE"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, marketplaceId: value === "NONE" ? undefined : value })
                  }
                  disabled={saving || loading}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a marketplace (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    {(marketplaces || []).map((marketplace) => (
                      <SelectItem key={marketplace.id} value={marketplace.id}>
                        {marketplace.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="category" className="text-right">
                  Category
                </Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="col-span-3"
                  disabled={saving}
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="skuCode" className="text-right">
                  SKU Code *
                </Label>
                <Input
                  id="skuCode"
                  value={formData.skuCode}
                  onChange={(e) =>
                    setFormData({ ...formData, skuCode: e.target.value })
                  }
                  className="col-span-3"
                  required
                  disabled={saving}
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="skuName" className="text-right">
                  SKU Name
                </Label>
                <Input
                  id="skuName"
                  value={formData.skuName}
                  onChange={(e) =>
                    setFormData({ ...formData, skuName: e.target.value })
                  }
                  className="col-span-3"
                  disabled={saving}
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="price" className="text-right">
                  Price
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  className="col-span-3"
                  disabled={saving}
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="cost" className="text-right">
                  Cost
                </Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost}
                  onChange={(e) =>
                    setFormData({ ...formData, cost: e.target.value })
                  }
                  className="col-span-3"
                  disabled={saving}
                />
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content for marketplace (OZON)</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mpTitle">Marketplace title</Label>
                <Input
                  id="mpTitle"
                  value={formData.mpTitle}
                  onChange={(e) =>
                    setFormData({ ...formData, mpTitle: e.target.value })
                  }
                  placeholder="Title for OZON listing"
                  disabled={saving}
                />
                <p className="text-sm text-muted-foreground">
                  This title will be sent to the marketplace as the main product name.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mpSubtitle">Subtitle</Label>
                <Input
                  id="mpSubtitle"
                  value={formData.mpSubtitle}
                  onChange={(e) =>
                    setFormData({ ...formData, mpSubtitle: e.target.value })
                  }
                  placeholder="Optional subtitle for the listing"
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mpShortDescription">Short description</Label>
                <Textarea
                  id="mpShortDescription"
                  value={formData.mpShortDescription}
                  onChange={(e) =>
                    setFormData({ ...formData, mpShortDescription: e.target.value })
                  }
                  placeholder="Short benefit-focused description for listing card."
                  rows={4}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mpDescription">Full description</Label>
                <Textarea
                  id="mpDescription"
                  value={formData.mpDescription}
                  onChange={(e) =>
                    setFormData({ ...formData, mpDescription: e.target.value })
                  }
                  placeholder="Full product description that will be sent to OZON."
                  rows={6}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="keywords">Keywords</Label>
                <Textarea
                  id="keywords"
                  value={formData.keywords}
                  onChange={(e) =>
                    setFormData({ ...formData, keywords: e.target.value })
                  }
                  placeholder="Comma-separated keywords, e.g.: facial serum, retinol, anti-aging..."
                  rows={3}
                  disabled={saving}
                />
                <p className="text-sm text-muted-foreground">
                  AI keyword agent will work with this field in future.
                </p>
              </div>

              <div className="flex items-start space-x-3 space-y-0">
                <Checkbox
                  id="aiContentEnabled"
                  checked={formData.aiContentEnabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, aiContentEnabled: !!checked })
                  }
                  disabled={saving}
                />
                <div className="space-y-1 leading-none">
                  <Label htmlFor="aiContentEnabled" className="cursor-pointer">
                    Allow AI to manage content
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    If enabled, AI agents (via n8n) will be allowed to update title, description and keywords.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/bcm/products")}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Creating..." : "Create Listing"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

