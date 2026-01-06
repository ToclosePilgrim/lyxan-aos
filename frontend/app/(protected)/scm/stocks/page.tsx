"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest } from "@/lib/api";

interface Stock {
  id: string;
  skuId: string;
  skuCode: string;
  skuName: string | null;
  productName: string;
  productBrand: string;
  quantity: number;
  updatedAt: string;
}

export default function StocksPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStocks();
  }, []);

  const loadStocks = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<Stock[]>(`/scm/stocks`);
      setStocks(data || []);
    } catch (error) {
      console.error("Failed to load stocks:", error);
      setStocks([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stocks</h1>
          <p className="text-muted-foreground mt-2">
            Управление остатками на складе
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Остатки</CardTitle>
            <CardDescription>
              {stocks.length} позиций
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Загрузка...</div>
            ) : stocks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Остатки не найдены
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Товар</TableHead>
                    <TableHead>Бренд</TableHead>
                    <TableHead>Количество</TableHead>
                    <TableHead>Обновлено</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stocks.map((stock) => (
                    <TableRow key={stock.id}>
                      <TableCell className="font-medium">
                        {stock.skuCode}
                      </TableCell>
                      <TableCell>{stock.productName}</TableCell>
                      <TableCell>{stock.productBrand}</TableCell>
                      <TableCell>{stock.quantity}</TableCell>
                      <TableCell>
                        {new Date(stock.updatedAt).toLocaleDateString("ru-RU")}
                      </TableCell>
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

