"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
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
import { apiRequest } from "@/lib/api";
import Link from "next/link";

interface Sku {
  id: string;
  code: string;
  name: string | null;
  price: number | null;
  cost: number | null;
  stockQuantity: number;
}

interface Product {
  id: string;
  name: string;
  category: string | null;
  brand: {
    id: string;
    name: string;
    code: string;
  };
  marketplace: {
    id: string;
    name: string;
    code: string;
  } | null;
  skus: Sku[];
}

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (productId) {
      loadProduct();
    }
  }, [productId]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<Product>(`/scm/products/${productId}`);
      setProduct(data);
    } catch (error) {
      console.error("Failed to load product:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-8">Загрузка...</div>
      </MainLayout>
    );
  }

  if (!product) {
    return (
      <MainLayout>
        <div className="text-center py-8 text-muted-foreground">
          Товар не найден
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
              <Link href="/scm/products">← Назад к списку</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{product.name}</CardTitle>
            <CardDescription>
              ID: {product.id}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Бренд</p>
                <p>{product.brand.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Маркетплейс
                </p>
                <p>{product.marketplace?.name || "-"}</p>
              </div>
              {product.category && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Категория
                  </p>
                  <p>{product.category}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SKU</CardTitle>
            <CardDescription>
              Единицы товара ({product.skus.length})
            </CardDescription>
          </CardHeader>
          <CardContent>
            {product.skus.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                SKU не найдены
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Код</TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead>Цена</TableHead>
                    <TableHead>Себестоимость</TableHead>
                    <TableHead>Остаток</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.skus.map((sku) => (
                    <TableRow key={sku.id}>
                      <TableCell className="font-medium">{sku.code}</TableCell>
                      <TableCell>{sku.name || "-"}</TableCell>
                      <TableCell>
                        {sku.price
                          ? `${sku.price.toLocaleString("ru-RU")} ₽`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {sku.cost
                          ? `${sku.cost.toLocaleString("ru-RU")} ₽`
                          : "-"}
                      </TableCell>
                      <TableCell>{sku.stockQuantity}</TableCell>
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

