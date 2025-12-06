"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api";

interface PnlData {
  totalRevenue: number;
  totalCommission: number;
  totalRefunds: number;
  totalCost: number;
  grossMargin: number;
  grossMarginPercent: number;
  dateFrom: string | null;
  dateTo: string | null;
}

export default function FinancePnlPage() {
  const [pnl, setPnl] = useState<PnlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    loadPnl();
  }, []);

  const loadPnl = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);

      const query = params.toString();
      const endpoint = `/finance/pnl${query ? `?${query}` : ""}`;
      const data = await apiRequest<PnlData>(endpoint);
      setPnl(data);
    } catch (error) {
      console.error("Failed to load P&L:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = () => {
    loadPnl();
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-8">Загрузка...</div>
      </MainLayout>
    );
  }

  if (!pnl) {
    return (
      <MainLayout>
        <div className="text-center py-8 text-muted-foreground">
          Данные не найдены
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">P&L</h1>
          <p className="text-muted-foreground mt-2">
            Profit & Loss отчёт
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Фильтр по дате</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateFrom">Дата от</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateTo">Дата до</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleUpdate}>Обновить</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Revenue</CardTitle>
              <CardDescription>Выручка</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {pnl.totalRevenue.toLocaleString("ru-RU")} ₽
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Commission</CardTitle>
              <CardDescription>Комиссия</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                -{pnl.totalCommission.toLocaleString("ru-RU")} ₽
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Refunds</CardTitle>
              <CardDescription>Возвраты</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                -{pnl.totalRefunds.toLocaleString("ru-RU")} ₽
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cost</CardTitle>
              <CardDescription>Себестоимость</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                -{pnl.totalCost.toLocaleString("ru-RU")} ₽
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gross Margin</CardTitle>
              <CardDescription>Валовая маржа</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  pnl.grossMargin >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {pnl.grossMargin.toLocaleString("ru-RU")} ₽
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gross Margin %</CardTitle>
              <CardDescription>Валовая маржа в процентах</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  pnl.grossMarginPercent >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {pnl.grossMarginPercent.toFixed(2)}%
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}

