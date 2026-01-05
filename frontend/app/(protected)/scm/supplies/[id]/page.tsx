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

interface SupplyItem {
  id: string;
  skuId: string;
  quantity: number;
  sku: {
    id: string;
    code: string;
    name: string | null;
    product: {
      id: string;
      name: string;
      brand: {
        name: string;
      };
    };
  };
}

interface Supply {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  itemsCount: number;
  totalQuantity: number;
  items: SupplyItem[];
}

export default function SupplyDetailPage() {
  const params = useParams();
  const supplyId = params.id as string;
  const [supply, setSupply] = useState<Supply | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (supplyId) {
      loadSupply();
    }
  }, [supplyId]);

  const loadSupply = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<Supply>(`/scm/supplies/${supplyId}`);
      setSupply(data);
    } catch (error) {
      console.error("Failed to load supply:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "RECEIVED":
        return "text-green-600";
      case "IN_TRANSIT":
        return "text-blue-600";
      case "CANCELLED":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-8">Загрузка...</div>
      </MainLayout>
    );
  }

  if (!supply) {
    return (
      <MainLayout>
        <div className="text-center py-8 text-muted-foreground">
          Поставка не найдена
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
              <Link href="/scm/supplies">← Назад к списку</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Поставка #{supply.id.substring(0, 8)}</CardTitle>
            <CardDescription>
              Дата создания: {new Date(supply.createdAt).toLocaleString("ru-RU")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Статус</p>
                <p className={getStatusColor(supply.status)}>{supply.status}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Позиций
                </p>
                <p>{supply.itemsCount}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Всего товаров
                </p>
                <p>{supply.totalQuantity}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Позиции поставки</CardTitle>
            <CardDescription>
              {supply.items.length} позиций
            </CardDescription>
          </CardHeader>
          <CardContent>
            {supply.items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Позиции не найдены
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Товар</TableHead>
                    <TableHead>Бренд</TableHead>
                    <TableHead>Количество</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supply.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.sku.code}
                      </TableCell>
                      <TableCell>{item.sku.product.name}</TableCell>
                      <TableCell>{item.sku.product.brand.name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
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

