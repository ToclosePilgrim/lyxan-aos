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
import { apiRequest } from "@/lib/api";
import Link from "next/link";

interface Product {
  id: string;
  name: string;
  brand: {
    id: string;
    name: string;
  };
  marketplace: {
    id: string;
    name: string;
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

export default function ProductCardPage() {
  const params = useParams();
  const productId = params.id as string;
  const [data, setData] = useState<ProductCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    attributes: "",
    images: "",
  });

  useEffect(() => {
    if (productId) {
      loadProductCard();
    }
  }, [productId]);

  const loadProductCard = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<ProductCardData>(
        `/bcm/products/${productId}`
      );
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
    } catch (error) {
      console.error("Failed to load product card:", error);
    } finally {
      setLoading(false);
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
          alert("Ошибка в JSON атрибутов. Проверьте формат.");
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

      alert("Карточка товара сохранена");
      loadProductCard(); // Reload to get updated data
    } catch (error: any) {
      console.error("Failed to save product card:", error);
      alert(error.message || "Ошибка при сохранении");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-8">Загрузка...</div>
      </MainLayout>
    );
  }

  if (!data) {
    return (
      <MainLayout>
        <div className="text-center py-8 text-muted-foreground">
          Карточка товара не найдена
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
              <Link href="/bcm/products">← Назад к списку</Link>
            </Button>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{data.product.name}</CardTitle>
            <CardDescription>
              Бренд: {data.product.brand.name}
              {data.product.marketplace && ` | Маркетплейс: ${data.product.marketplace.name}`}
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="attributes">Attributes</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Основная информация</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Заголовок</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="Заголовок товара"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Описание</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        description: e.target.value,
                      })
                    }
                    placeholder="Описание товара"
                    rows={6}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attributes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Атрибуты</CardTitle>
                <CardDescription>
                  JSON формат атрибутов товара
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
                <CardTitle>Галерея изображений</CardTitle>
                <CardDescription>
                  URL изображений (по одному на строку)
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
        </Tabs>
      </div>
    </MainLayout>
  );
}

