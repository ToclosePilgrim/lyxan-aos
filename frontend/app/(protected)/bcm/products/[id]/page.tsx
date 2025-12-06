"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, prefillTechnicalFromScm } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";
import { format } from "date-fns";

interface Product {
  id: string;
  name: string;
  scmProductId?: string | null;
  title?: string | null;
  subtitle?: string | null;
  shortDescription?: string | null;
  fullDescription?: string | null;
  keywords?: string | null;
  mpTitle?: string | null;
  mpSubtitle?: string | null;
  mpShortDescription?: string | null;
  mpDescription?: string | null;
  aiContentEnabled?: boolean;
  brand: {
    id: string;
    name: string;
  };
  marketplace: {
    id: string;
    name: string;
  } | null;
  scmProduct: {
    id: string;
    internalName: string;
    sku: string | null;
    brand: {
      id: string;
      name: string;
      code: string;
    } | null;
  } | null;
}

interface ProductCard {
  id: string;
  title: string | null;
  description: string | null;
  attributes: any;
  images: string[] | null;
}

interface ProductCardData {
  product: Product;
  card: ProductCard;
}

interface ProductContentVersion {
  id: string;
  productId: string;
  marketplaceCode?: string | null;
  mpTitle?: string | null;
  mpSubtitle?: string | null;
  mpShortDescription?: string | null;
  mpDescription?: string | null;
  keywords?: string | null;
  contentAttributes?: Record<string, unknown> | null;
  source: 'MANUAL' | 'AI' | 'SYSTEM';
  userId?: string | null;
  user?: {
    id: string;
    email: string;
  } | null;
  agentLabel?: string | null;
  comment?: string | null;
  createdAt: string;
}

export default function ProductCardPage() {
  const params = useParams();
  const productId = params.id as string;
  const [data, setData] = useState<ProductCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState<ProductContentVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<ProductContentVersion | null>(null);
  const [isPrefilling, setIsPrefilling] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    attributes: "",
    images: "",
  });

  const [contentFormData, setContentFormData] = useState({
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
    if (productId) {
      loadProductCard();
      loadProduct();
      loadVersions();
    }
  }, [productId]);

  const loadProductCard = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<ProductCardData>(
        `/bcm/products/${productId}`
      );
      if (data && data.product && data.card) {
        setData(data);
        
        // Initialize form data
        setFormData({
          title: data.card.title || "",
          description: data.card.description || "",
          attributes: data.card.attributes
            ? JSON.stringify(data.card.attributes, null, 2)
            : "",
          images: Array.isArray(data.card.images)
            ? data.card.images.join("\n")
            : "",
        });
      }
    } catch (error) {
      console.error("Failed to load product card:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadProduct = async () => {
    try {
      const product = await apiRequest<Product>(`/scm/products/${productId}`);
      if (product) {
        setContentFormData({
          title: product.title || "",
          subtitle: product.subtitle || "",
          shortDescription: product.shortDescription || "",
          fullDescription: product.fullDescription || "",
          keywords: product.keywords || "",
          mpTitle: product.mpTitle || "",
          mpSubtitle: product.mpSubtitle || "",
          mpShortDescription: product.mpShortDescription || "",
          mpDescription: product.mpDescription || "",
          aiContentEnabled: product.aiContentEnabled ?? true,
        });
      }
    } catch (error) {
      console.error("Failed to load product:", error);
    }
  };

  const loadVersions = async () => {
    try {
      setLoadingVersions(true);
      const data = await apiRequest<ProductContentVersion[]>(`/bcm/products/${productId}/content-versions`);
      setVersions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load versions:", error);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Parse attributes if provided
      let attributes: any = undefined;
      if (formData.attributes.trim()) {
        try {
          attributes = JSON.parse(formData.attributes);
        } catch (e) {
          toast.error("Error in JSON attributes", {
            description: "Please check the format.",
          });
          return;
        }
      }

      // Parse images (split by newline)
      let images: string[] | undefined = undefined;
      if (formData.images.trim()) {
        images = formData.images
          .split("\n")
          .map((url) => url.trim())
          .filter((url) => url.length > 0);
      }

      await apiRequest(`/bcm/products/${productId}/card`, {
        method: "PATCH",
        body: JSON.stringify({
          title: formData.title || undefined,
          description: formData.description || undefined,
          attributes: attributes,
          images: images,
        }),
      });

      toast.success("Listing card saved");
      loadProductCard(); // Reload to get updated data
    } catch (error: any) {
      console.error("Failed to save listing card:", error);
      toast.error("Failed to save", {
        description: error.message || "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePrefillFromScm = async () => {
    if (!data?.product?.scmProductId) {
      toast.error('SCM product is not linked to this listing');
      return;
    }

    try {
      setIsPrefilling(true);
      await prefillTechnicalFromScm(productId);
      
      // Reload product data
      await loadProduct();
      await loadProductCard();
      
      toast.success('Technical data has been prefilled from SCM product');
    } catch (error: any) {
      console.error('Failed to prefill technical data:', error);
      const errorMessage = error.message || 'Failed to prefill technical data from SCM';
      toast.error(errorMessage);
    } finally {
      setIsPrefilling(false);
    }
  };

  const handleSaveContent = async () => {
    try {
      setSaving(true);
      await apiRequest(`/scm/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: contentFormData.title || null,
          subtitle: contentFormData.subtitle || null,
          shortDescription: contentFormData.shortDescription || null,
          fullDescription: contentFormData.fullDescription || null,
          keywords: contentFormData.keywords || null,
          mpTitle: contentFormData.mpTitle || null,
          mpSubtitle: contentFormData.mpSubtitle || null,
          mpShortDescription: contentFormData.mpShortDescription || null,
          mpDescription: contentFormData.mpDescription || null,
          aiContentEnabled: contentFormData.aiContentEnabled,
        }),
      });

      toast.success("Content saved");
      loadProduct(); // Reload to get updated data
      loadVersions(); // Reload versions
    } catch (error: any) {
      console.error("Failed to save content:", error);
      toast.error("Failed to save content", {
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

  if (!data) {
    return (
      <MainLayout>
        <div className="text-center py-8 text-muted-foreground">
          Listing not found
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Listing Details</h1>
            <p className="text-muted-foreground mt-2">
              View and edit marketplace listing
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/bcm/products">← Back to list</Link>
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Card"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{data.product.name}</CardTitle>
            <CardDescription>
              Brand: {data.product.brand.name}
              {data.product.marketplace && ` | Marketplace: ${data.product.marketplace.name}`}
              {data.product.scmProduct ? (
                <>
                  {" | "}
                  <Link
                    href={`/scm/products/${data.product.scmProduct.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    SCM Product: {data.product.scmProduct.internalName}
                    {data.product.scmProduct.sku && ` [${data.product.scmProduct.sku}]`}
                  </Link>
                </>
              ) : (
                <>
                  {" | "}
                  <span className="text-orange-600 font-medium">
                    ⚠ Listing is not linked to SCM Product
                  </span>
                </>
              )}
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs defaultValue="content" className="space-y-4">
          <TabsList>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="attributes">Attributes</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Content for marketplace (OZON)</CardTitle>
                <CardDescription>
                  Listing content fields for marketplace (e.g. OZON)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="content-mpTitle">Marketplace title</Label>
                  <div className="flex gap-2">
                    <Input
                      id="content-mpTitle"
                      value={contentFormData.mpTitle}
                      onChange={(e) =>
                        setContentFormData({ ...contentFormData, mpTitle: e.target.value })
                      }
                      placeholder="Title for OZON listing"
                      disabled={saving}
                      className="flex-1"
                    />
                    {/* TODO: Generate with AI button */}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This title will be sent to the marketplace as the main product name.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content-mpSubtitle">Subtitle</Label>
                  <Input
                    id="content-mpSubtitle"
                    value={contentFormData.mpSubtitle}
                    onChange={(e) =>
                      setContentFormData({ ...contentFormData, mpSubtitle: e.target.value })
                    }
                    placeholder="Optional subtitle for the listing"
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content-mpShortDescription">Short description</Label>
                  <Textarea
                    id="content-mpShortDescription"
                    value={contentFormData.mpShortDescription}
                    onChange={(e) =>
                      setContentFormData({ ...contentFormData, mpShortDescription: e.target.value })
                    }
                    placeholder="Short benefit-focused description for listing card."
                    rows={4}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content-mpDescription">Full description</Label>
                  <Textarea
                    id="content-mpDescription"
                    value={contentFormData.mpDescription}
                    onChange={(e) =>
                      setContentFormData({ ...contentFormData, mpDescription: e.target.value })
                    }
                    placeholder="Full product description that will be sent to OZON."
                    rows={6}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content-keywords">Keywords</Label>
                  <Textarea
                    id="content-keywords"
                    value={contentFormData.keywords}
                    onChange={(e) =>
                      setContentFormData({ ...contentFormData, keywords: e.target.value })
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
                    id="content-aiContentEnabled"
                    checked={contentFormData.aiContentEnabled}
                    onCheckedChange={(checked) =>
                      setContentFormData({ ...contentFormData, aiContentEnabled: !!checked })
                    }
                    disabled={saving}
                  />
                  <div className="space-y-1 leading-none">
                    <Label htmlFor="content-aiContentEnabled" className="cursor-pointer">
                      Allow AI to manage content
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      If enabled, AI agents (via n8n) will be allowed to update title, description and keywords.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveContent} disabled={saving}>
                    {saving ? "Saving..." : "Save Content"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>General Information</CardTitle>
                  {data?.product?.scmProductId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrefillFromScm}
                      disabled={isPrefilling || !data?.product?.scmProductId}
                    >
                      {isPrefilling ? 'Filling...' : 'Fill from SCM'}
                    </Button>
                  )}
                </div>
                {!data?.product?.scmProductId && (
                  <CardDescription className="text-sm text-muted-foreground mt-2">
                    Link an SCM product to enable auto-fill of technical data
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="Listing title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        description: e.target.value,
                      })
                    }
                    placeholder="Listing description"
                    rows={6}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attributes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Attributes</CardTitle>
                <CardDescription>
                  JSON format for listing attributes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="attributes">Attributes (JSON)</Label>
                  <Textarea
                    id="attributes"
                    value={formData.attributes}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        attributes: e.target.value,
                      })
                    }
                    placeholder='{"color": "red", "size": "M"}'
                    rows={10}
                    className="font-mono text-sm"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="images" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Image Gallery</CardTitle>
                <CardDescription>
                  Image URLs (one per line)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="images">Image URLs</Label>
                  <Textarea
                    id="images"
                    value={formData.images}
                    onChange={(e) =>
                      setFormData({ ...formData, images: e.target.value })
                    }
                    placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                    rows={10}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Content History</CardTitle>
                <CardDescription>
                  Version history of content changes for this listing
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingVersions ? (
                  <div className="text-center py-4 text-muted-foreground">Loading versions...</div>
                ) : versions.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No content versions yet
                  </div>
                ) : (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Agent</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Keywords</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {versions.map((version) => (
                          <TableRow key={version.id}>
                            <TableCell>
                              {format(new Date(version.createdAt), 'yyyy-MM-dd HH:mm')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{version.source}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {version.agentLabel || '-'}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {version.mpTitle || '-'}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {version.keywords || '-'}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedVersion(version)}
                              >
                                View
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
        </Tabs>
      </div>

      <Dialog open={!!selectedVersion} onOpenChange={(open) => !open && setSelectedVersion(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Content Version Details</DialogTitle>
            <DialogDescription>
              Snapshot of marketplace content at {selectedVersion && format(new Date(selectedVersion.createdAt), 'yyyy-MM-dd HH:mm:ss')}
            </DialogDescription>
          </DialogHeader>
          {selectedVersion && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold">Source</Label>
                  <div><Badge variant="outline">{selectedVersion.source}</Badge></div>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Agent</Label>
                  <div className="text-sm text-muted-foreground">
                    {selectedVersion.agentLabel || '-'}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Comment</Label>
                  <div className="text-sm text-muted-foreground">
                    {selectedVersion.comment || '-'}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-semibold">User</Label>
                  <div className="text-sm text-muted-foreground">
                    {selectedVersion.user?.email || '-'}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Marketplace Title</Label>
                <div className="p-2 bg-muted rounded-md text-sm">
                  {selectedVersion.mpTitle || '-'}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Subtitle</Label>
                <div className="p-2 bg-muted rounded-md text-sm">
                  {selectedVersion.mpSubtitle || '-'}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Short Description</Label>
                <div className="p-2 bg-muted rounded-md text-sm whitespace-pre-wrap">
                  {selectedVersion.mpShortDescription || '-'}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Full Description</Label>
                <div className="p-2 bg-muted rounded-md text-sm whitespace-pre-wrap">
                  {selectedVersion.mpDescription || '-'}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Keywords</Label>
                <div className="p-2 bg-muted rounded-md text-sm whitespace-pre-wrap">
                  {selectedVersion.keywords || '-'}
                </div>
              </div>

              {selectedVersion.contentAttributes && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Content Attributes</Label>
                  <pre className="p-2 bg-muted rounded-md text-xs overflow-auto">
                    {JSON.stringify(selectedVersion.contentAttributes, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

