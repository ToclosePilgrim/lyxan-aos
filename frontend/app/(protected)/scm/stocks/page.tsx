"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [editingStock, setEditingStock] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(0);

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

  const handleEdit = (stock: Stock) => {
    setEditingStock(stock.skuId);
    setEditQuantity(stock.quantity);
  };

  const handleSave = async (skuId: string) => {
    try {
      await apiRequest(`/scm/stocks/${skuId}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity: editQuantity }),
      });
      setEditingStock(null);
      loadStocks();
    } catch (error) {
      console.error("Failed to update stock:", error);
      alert("Ошибка при обновлении остатка");
    }
  };

  const handleCancel = () => {
    setEditingStock(null);
    setEditQuantity(0);
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
                    <TableHead>Действия</TableHead>
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
                      <TableCell>
                        {editingStock === stock.skuId ? (
                          <Input
                            type="number"
                            value={editQuantity}
                            onChange={(e) =>
                              setEditQuantity(parseInt(e.target.value) || 0)
                            }
                            className="w-24"
                          />
                        ) : (
                          stock.quantity
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(stock.updatedAt).toLocaleDateString("ru-RU")}
                      </TableCell>
                      <TableCell>
                        {editingStock === stock.skuId ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSave(stock.skuId)}
                            >
                              Сохранить
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancel}
                            >
                              Отмена
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(stock)}
                          >
                            Изменить
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
      </div>
    </MainLayout>
  );
}

