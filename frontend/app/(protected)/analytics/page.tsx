"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface DashboardData {
  sales: {
    totalRevenue: number;
    totalOrders: number;
    avgCheck: number;
    totalRefunds: number;
  };
  margin: {
    totalCost: number;
    grossMargin: number;
    grossMarginPercent: number;
  };
  advertising: {
    totalSpend: number;
    roas: number;
  };
  stocks: {
    totalSkus: number;
    totalQuantity: number;
    lowStockSkus: number;
  };
  support: {
    totalReviews: number;
    avgRating: number;
    negativeReviews: number;
  };
}

interface FinanceReport {
  date: string;
  revenue: number;
  quantity: number;
  refunds: number;
}

interface AdStat {
  date: string;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  orders: number | null;
  revenue: number | null;
}

interface Review {
  id: string;
  date: string;
  rating: number;
  text: string | null;
  sku: {
    code: string;
  } | null;
}

export default function AnalyticsPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [salesData, setSalesData] = useState<FinanceReport[]>([]);
  const [adData, setAdData] = useState<AdStat[]>([]);
  const [negativeReviews, setNegativeReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    loadDashboard();
    loadSalesData();
    loadAdData();
    loadNegativeReviews();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);

      const query = params.toString();
      const endpoint = `/analytics/dashboard${query ? `?${query}` : ""}`;
      const data = await apiRequest<DashboardData>(endpoint);
      setDashboard(data);
    } catch (error) {
      console.error("Failed to load dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSalesData = async () => {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);

      const query = params.toString();
      const endpoint = `/finance/reports${query ? `?${query}` : ""}`;
      const data = await apiRequest<any[]>(endpoint);
      
      // Group by date
      const grouped: { [key: string]: FinanceReport } = {};
      (Array.isArray(data) ? data : []).forEach((report: any) => {
        const dateKey = new Date(report.date).toISOString().split("T")[0];
        if (!grouped[dateKey]) {
          grouped[dateKey] = {
            date: dateKey,
            revenue: 0,
            quantity: 0,
            refunds: 0,
          };
        }
        grouped[dateKey].revenue += report.revenue || 0;
        grouped[dateKey].quantity += report.quantity || 0;
        grouped[dateKey].refunds += report.refunds || 0;
      });

      setSalesData(
        Object.values(grouped).sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
      );
    } catch (error) {
      console.error("Failed to load sales data:", error);
    }
  };

  const loadAdData = async () => {
    try {
      // Get all campaigns and their stats
      const campaigns = await apiRequest<any[]>(`/advertising/campaigns`);
      const allStats: AdStat[] = [];

      for (const campaign of campaigns) {
        const params = new URLSearchParams();
        if (dateFrom) params.append("dateFrom", dateFrom);
        if (dateTo) params.append("dateTo", dateTo);

        const query = params.toString();
        const campaignDetail = await apiRequest<any>(
          `/advertising/campaigns/${campaign.id}${query ? `?${query}` : ""}`
        );

        if (campaignDetail.stats) {
          allStats.push(...campaignDetail.stats);
        }
      }

      // Group by date
      const grouped: { [key: string]: AdStat } = {};
      allStats.forEach((stat) => {
        const dateKey = new Date(stat.date).toISOString().split("T")[0];
        if (!grouped[dateKey]) {
          grouped[dateKey] = {
            date: dateKey,
            impressions: 0,
            clicks: 0,
            spend: 0,
            orders: 0,
            revenue: 0,
          };
        }
        grouped[dateKey].impressions =
          (grouped[dateKey].impressions || 0) + (stat.impressions || 0);
        grouped[dateKey].clicks =
          (grouped[dateKey].clicks || 0) + (stat.clicks || 0);
        grouped[dateKey].spend =
          (grouped[dateKey].spend || 0) + (stat.spend || 0);
        grouped[dateKey].orders =
          (grouped[dateKey].orders || 0) + (stat.orders || 0);
        grouped[dateKey].revenue =
          (grouped[dateKey].revenue || 0) + (stat.revenue || 0);
      });

      setAdData(
        Object.values(grouped).sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
      );
    } catch (error) {
      console.error("Failed to load ad data:", error);
    }
  };

  const loadNegativeReviews = async () => {
    try {
      const data = await apiRequest<Review[]>(`/support/reviews?minRating=1`);
      const negative = data
        .filter((r) => r.rating <= 2)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

      setNegativeReviews(negative);
    } catch (error) {
      console.error("Failed to load negative reviews:", error);
    }
  };

  const handleUpdate = () => {
    loadDashboard();
    loadSalesData();
    loadAdData();
    loadNegativeReviews();
  };

  const calculateCTR = (impressions: number | null, clicks: number | null) => {
    if (!impressions || !clicks || impressions === 0) return null;
    return ((clicks / impressions) * 100).toFixed(2);
  };

  const calculateROAS = (spend: number | null, revenue: number | null) => {
    if (!spend || !revenue || spend === 0) return null;
    return (revenue / spend).toFixed(2);
  };

  if (loading && !dashboard) {
    return (
      <MainLayout>
        <div className="text-center py-8">Загрузка...</div>
      </MainLayout>
    );
  }

  if (!dashboard) {
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Бизнес-аналитика и метрики
            </p>
          </div>
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

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {dashboard.sales.totalRevenue.toLocaleString("ru-RU")} ₽
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboard.sales.totalOrders}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Gross Margin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {dashboard.margin.grossMargin.toLocaleString("ru-RU")} ₽
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Gross Margin %</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboard.margin.grossMarginPercent.toFixed(1)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Ad Spend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {dashboard.advertising.totalSpend.toLocaleString("ru-RU")} ₽
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">ROAS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboard.advertising.roas.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sales Table */}
        <Card>
          <CardHeader>
            <CardTitle>Продажи</CardTitle>
            <CardDescription>Данные по продажам за период</CardDescription>
          </CardHeader>
          <CardContent>
            {salesData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Данные не найдены
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Refunds</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesData.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {new Date(item.date).toLocaleDateString("ru-RU")}
                      </TableCell>
                      <TableCell>
                        {item.revenue.toLocaleString("ru-RU")} ₽
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>
                        {item.refunds.toLocaleString("ru-RU")} ₽
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Advertising Table */}
        <Card>
          <CardHeader>
            <CardTitle>Реклама</CardTitle>
            <CardDescription>Агрегаты по дням</CardDescription>
          </CardHeader>
          <CardContent>
            {adData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Данные не найдены
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Impressions</TableHead>
                    <TableHead>Clicks</TableHead>
                    <TableHead>CTR</TableHead>
                    <TableHead>Spend</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>ROAS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adData.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {new Date(item.date).toLocaleDateString("ru-RU")}
                      </TableCell>
                      <TableCell>{item.impressions || "-"}</TableCell>
                      <TableCell>{item.clicks || "-"}</TableCell>
                      <TableCell>
                        {calculateCTR(item.impressions, item.clicks)
                          ? `${calculateCTR(item.impressions, item.clicks)}%`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {item.spend
                          ? `${item.spend.toLocaleString("ru-RU")} ₽`
                          : "-"}
                      </TableCell>
                      <TableCell>{item.orders || "-"}</TableCell>
                      <TableCell>
                        {item.revenue
                          ? `${item.revenue.toLocaleString("ru-RU")} ₽`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {calculateROAS(item.spend, item.revenue) || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Negative Reviews Table */}
        <Card>
          <CardHeader>
            <CardTitle>Топ негативных отзывов</CardTitle>
            <CardDescription>Первые 10 отзывов с рейтингом ≤ 2</CardDescription>
          </CardHeader>
          <CardContent>
            {negativeReviews.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Негативные отзывы не найдены
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Text</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {negativeReviews.map((review) => (
                    <TableRow key={review.id}>
                      <TableCell>
                        {new Date(review.date).toLocaleDateString("ru-RU")}
                      </TableCell>
                      <TableCell>
                        {review.sku ? review.sku.code : "-"}
                      </TableCell>
                      <TableCell>
                        <span className="text-red-600 font-medium">
                          {review.rating} ⭐
                        </span>
                      </TableCell>
                      <TableCell>
                        {review.text && review.text.length > 50
                          ? `${review.text.substring(0, 50)}...`
                          : review.text || "-"}
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
