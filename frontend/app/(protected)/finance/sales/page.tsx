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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/api";
import { useScope } from "@/context/scope-context";

interface FinanceReport {
  id: string;
  date: string;
  quantity: number;
  revenue: number;
  commission: number;
  refunds: number;
  sku: {
    id: string;
    code: string;
    product: {
      name: string;
    };
  };
}

interface Sku {
  id: string;
  code: string;
  product: {
    name: string;
  };
}

export default function FinanceSalesPage() {
  const { ready, scopeKey } = useScope();
  const [reports, setReports] = useState<FinanceReport[]>([]);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    skuId: "",
  });

  const [formData, setFormData] = useState({
    skuId: "",
    date: "",
    quantity: "",
    revenue: "",
    commission: "",
    refunds: "",
  });

  useEffect(() => {
    if (!ready) return;
    loadReports();
    loadSkus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, scopeKey]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.dateFrom) params.append("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.append("dateTo", filters.dateTo);
      if (filters.skuId) params.append("skuId", filters.skuId);

      const query = params.toString();
      const endpoint = `/finance/reports${query ? `?${query}` : ""}`;
      const data = await apiRequest<{ data: FinanceReport[] }>(endpoint);
      setReports(data.data || []);
    } catch (error) {
      console.error("Failed to load reports:", error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSkus = async () => {
    try {
      // Load SKUs from products
      const response = await apiRequest<{ data: any[] }>(`/scm/products?limit=100`);
      const products = response.data || [];
      const allSkus: Sku[] = [];
      
      for (const product of products) {
        try {
          const productDetail = await apiRequest<any>(`/scm/products/${product.id}`);
          if (productDetail.skus) {
            for (const sku of productDetail.skus) {
              allSkus.push({
                id: sku.id,
                code: sku.code,
                product: {
                  name: product.name,
                },
              });
            }
          }
        } catch (err) {
          // Skip products that can't be loaded
          console.error(`Failed to load product ${product.id}:`, err);
        }
      }
      setSkus(allSkus.filter(s => s?.id));
    } catch (error) {
      console.error("Failed to load SKUs:", error);
      setSkus([]);
    }
  };

  const handleApplyFilters = () => {
    loadReports();
  };

  const handleAddReport = async () => {
    try {
      setSaving(true);
      await apiRequest(`/finance/reports`, {
        method: "POST",
        body: JSON.stringify({
          skuId: formData.skuId,
          date: formData.date,
          quantity: parseInt(formData.quantity),
          revenue: parseFloat(formData.revenue),
          commission: formData.commission ? parseFloat(formData.commission) : undefined,
          refunds: formData.refunds ? parseFloat(formData.refunds) : undefined,
        }),
      });

      // Reset form
      setFormData({
        skuId: "",
        date: "",
        quantity: "",
        revenue: "",
        commission: "",
        refunds: "",
      });
      setOpenDialog(false);
      loadReports();
      alert("Финансовая строка добавлена");
    } catch (error: any) {
      console.error("Failed to add report:", error);
      alert(error.message || "Ошибка при добавлении");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sales</h1>
            <p className="text-muted-foreground mt-2">
              Финансовые отчёты по продажам
            </p>
          </div>
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button>Добавить строку</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Добавить финансовую строку</DialogTitle>
                <DialogDescription>
                  Введите данные о продаже
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Select
                    value={formData.skuId ?? ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, skuId: value })
                    }
                  >
                    <SelectTrigger id="sku">
                      <SelectValue placeholder="Выберите SKU" />
                    </SelectTrigger>
                    <SelectContent>
                      {skus.filter(s => s?.id).map((sku) => (
                        <SelectItem key={sku.id} value={String(sku.id)}>
                          {sku.code} - {sku.product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Дата</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Количество</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="revenue">Revenue</Label>
                  <Input
                    id="revenue"
                    type="number"
                    step="0.01"
                    value={formData.revenue}
                    onChange={(e) =>
                      setFormData({ ...formData, revenue: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commission">Commission</Label>
                  <Input
                    id="commission"
                    type="number"
                    step="0.01"
                    value={formData.commission}
                    onChange={(e) =>
                      setFormData({ ...formData, commission: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="refunds">Refunds</Label>
                  <Input
                    id="refunds"
                    type="number"
                    step="0.01"
                    value={formData.refunds}
                    onChange={(e) =>
                      setFormData({ ...formData, refunds: e.target.value })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpenDialog(false)}
                  disabled={saving}
                >
                  Отмена
                </Button>
                <Button onClick={handleAddReport} disabled={saving}>
                  {saving ? "Сохранение..." : "Добавить"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Фильтры</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateFrom">Дата от</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) =>
                    setFilters({ ...filters, dateFrom: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateTo">Дата до</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) =>
                    setFilters({ ...filters, dateTo: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skuFilter">SKU</Label>
                <Select
                  value={filters.skuId ?? ""}
                  onValueChange={(value) =>
                    setFilters({ ...filters, skuId: value })
                  }
                >
                  <SelectTrigger id="skuFilter" className="w-48">
                    <SelectValue placeholder="Все SKU" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Все SKU</SelectItem>
                    {skus.filter(s => s?.id).map((sku) => (
                      <SelectItem key={sku.id} value={String(sku.id)}>
                        {sku.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleApplyFilters}>Применить</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Продажи</CardTitle>
            <CardDescription>
              {reports.length} строк(и)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Загрузка...</div>
            ) : reports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Продажи не найдены
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>SKU Code</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Refunds</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        {new Date(report.date).toLocaleDateString("ru-RU")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {report.sku.code}
                      </TableCell>
                      <TableCell>{report.quantity}</TableCell>
                      <TableCell>
                        {report.revenue.toLocaleString("ru-RU")} ₽
                      </TableCell>
                      <TableCell>
                        {report.commission.toLocaleString("ru-RU")} ₽
                      </TableCell>
                      <TableCell>
                        {report.refunds.toLocaleString("ru-RU")} ₽
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

