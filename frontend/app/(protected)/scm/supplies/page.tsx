"use client";

import { useState, useEffect } from "react";
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

interface Supply {
  id: string;
  status: string;
  createdAt: string;
  itemsCount: number;
  totalQuantity: number;
}

export default function SuppliesPage() {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSupplies();
  }, []);

  const loadSupplies = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<Supply[]>(`/scm/supplies`);
      setSupplies(data || []);
    } catch (error) {
      console.error("Failed to load supplies:", error);
      setSupplies([]);
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

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Supplies</h1>
            <p className="text-muted-foreground mt-2">
              Управление поставками
            </p>
          </div>
          <Button asChild>
            <Link href="/scm/supplies/new">Создать поставку</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Список поставок</CardTitle>
            <CardDescription>
              {supplies.length} поставок
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Загрузка...</div>
            ) : supplies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Поставки не найдены
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Позиций</TableHead>
                    <TableHead>Всего товаров</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplies.map((supply) => (
                    <TableRow key={supply.id}>
                      <TableCell className="font-mono text-sm">
                        {supply.id.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        {new Date(supply.createdAt).toLocaleDateString("ru-RU")}
                      </TableCell>
                      <TableCell>
                        <span className={getStatusColor(supply.status)}>
                          {supply.status}
                        </span>
                      </TableCell>
                      <TableCell>{supply.itemsCount}</TableCell>
                      <TableCell>{supply.totalQuantity}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/scm/supplies/${supply.id}`}>
                            Открыть
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
      </div>
    </MainLayout>
  );
}

