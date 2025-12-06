"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/api";
import Link from "next/link";

interface AdStat {
  id: string;
  date: string;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  orders: number | null;
  revenue: number | null;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  budget: number | null;
  marketplace: {
    id: string;
    name: string;
    code: string;
  };
  stats: AdStat[];
  aggregates: {
    totalSpend: number;
    totalRevenue: number;
    totalOrders: number;
    roas: number | null;
  };
}

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editingStat, setEditingStat] = useState<AdStat | null>(null);
  const [saving, setSaving] = useState(false);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [formData, setFormData] = useState({
    date: "",
    impressions: "",
    clicks: "",
    spend: "",
    orders: "",
    revenue: "",
  });

  useEffect(() => {
    if (campaignId) {
      loadCampaign();
    }
  }, [campaignId, dateFrom, dateTo]);

  const loadCampaign = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);

      const query = params.toString();
      const endpoint = `/advertising/campaigns/${campaignId}${query ? `?${query}` : ""}`;
      const data = await apiRequest<Campaign>(endpoint);
      setCampaign(data);
    } catch (error) {
      console.error("Failed to load campaign:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStat = async () => {
    try {
      setSaving(true);
      await apiRequest(`/advertising/stats`, {
        method: "POST",
        body: JSON.stringify({
          campaignId,
          date: formData.date,
          impressions: formData.impressions ? parseInt(formData.impressions) : undefined,
          clicks: formData.clicks ? parseInt(formData.clicks) : undefined,
          spend: formData.spend ? parseFloat(formData.spend) : undefined,
          orders: formData.orders ? parseInt(formData.orders) : undefined,
          revenue: formData.revenue ? parseFloat(formData.revenue) : undefined,
        }),
      });

      setFormData({
        date: "",
        impressions: "",
        clicks: "",
        spend: "",
        orders: "",
        revenue: "",
      });
      setOpenAddDialog(false);
      loadCampaign();
      alert("Статистика добавлена");
    } catch (error: any) {
      console.error("Failed to add stat:", error);
      alert(error.message || "Ошибка при добавлении статистики");
    } finally {
      setSaving(false);
    }
  };

  const handleEditStat = (stat: AdStat) => {
    setEditingStat(stat);
    setFormData({
      date: stat.date.split("T")[0],
      impressions: stat.impressions?.toString() || "",
      clicks: stat.clicks?.toString() || "",
      spend: stat.spend?.toString() || "",
      orders: stat.orders?.toString() || "",
      revenue: stat.revenue?.toString() || "",
    });
    setOpenEditDialog(true);
  };

  const handleUpdateStat = async () => {
    if (!editingStat) return;

    try {
      setSaving(true);
      await apiRequest(`/advertising/stats/${editingStat.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          impressions: formData.impressions ? parseInt(formData.impressions) : undefined,
          clicks: formData.clicks ? parseInt(formData.clicks) : undefined,
          spend: formData.spend ? parseFloat(formData.spend) : undefined,
          orders: formData.orders ? parseInt(formData.orders) : undefined,
          revenue: formData.revenue ? parseFloat(formData.revenue) : undefined,
        }),
      });

      setEditingStat(null);
      setFormData({
        date: "",
        impressions: "",
        clicks: "",
        spend: "",
        orders: "",
        revenue: "",
      });
      setOpenEditDialog(false);
      loadCampaign();
      alert("Статистика обновлена");
    } catch (error: any) {
      console.error("Failed to update stat:", error);
      alert(error.message || "Ошибка при обновлении статистики");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      await apiRequest(`/advertising/campaigns/${campaignId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      loadCampaign();
      alert("Статус обновлён");
    } catch (error: any) {
      console.error("Failed to update status:", error);
      alert(error.message || "Ошибка при обновлении статуса");
    }
  };

  const calculateCTR = (impressions: number | null, clicks: number | null) => {
    if (!impressions || !clicks || impressions === 0) return null;
    return ((clicks / impressions) * 100).toFixed(2);
  };

  const calculateCPC = (clicks: number | null, spend: number | null) => {
    if (!clicks || !spend || clicks === 0) return null;
    return (spend / clicks).toFixed(2);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-8">Загрузка...</div>
      </MainLayout>
    );
  }

  if (!campaign) {
    return (
      <MainLayout>
        <div className="text-center py-8 text-muted-foreground">
          Кампания не найдена
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
              <Link href="/advertising/campaigns">← Назад к списку</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{campaign.name}</CardTitle>
                <CardDescription>
                  Marketplace: {campaign.marketplace.name}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={campaign.status}
                  onValueChange={handleUpdateStatus}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                    <SelectItem value="PAUSED">PAUSED</SelectItem>
                    <SelectItem value="STOPPED">STOPPED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Budget</p>
                <p>
                  {campaign.budget
                    ? `${campaign.budget.toLocaleString("ru-RU")} ₽`
                    : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Spend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {campaign.aggregates.totalSpend.toLocaleString("ru-RU")} ₽
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {campaign.aggregates.totalRevenue.toLocaleString("ru-RU")} ₽
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {campaign.aggregates.totalOrders}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">ROAS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {campaign.aggregates.roas
                  ? campaign.aggregates.roas.toFixed(2)
                  : "-"}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Дневная статистика</CardTitle>
                <CardDescription>
                  {campaign.stats.length} дней
                </CardDescription>
              </div>
              <div className="flex gap-4">
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    placeholder="Дата от"
                    className="w-40"
                  />
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    placeholder="Дата до"
                    className="w-40"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                    }}
                  >
                    Сбросить
                  </Button>
                </div>
                <Dialog open={openAddDialog} onOpenChange={setOpenAddDialog}>
                  <Button onClick={() => setOpenAddDialog(true)}>
                    Добавить день статистики
                  </Button>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Добавить статистику</DialogTitle>
                      <DialogDescription>
                        Введите данные за день
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="statDate">Дата</Label>
                        <Input
                          id="statDate"
                          type="date"
                          value={formData.date}
                          onChange={(e) =>
                            setFormData({ ...formData, date: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="impressions">Impressions</Label>
                        <Input
                          id="impressions"
                          type="number"
                          value={formData.impressions}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              impressions: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="clicks">Clicks</Label>
                        <Input
                          id="clicks"
                          type="number"
                          value={formData.clicks}
                          onChange={(e) =>
                            setFormData({ ...formData, clicks: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="spend">Spend</Label>
                        <Input
                          id="spend"
                          type="number"
                          step="0.01"
                          value={formData.spend}
                          onChange={(e) =>
                            setFormData({ ...formData, spend: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="orders">Orders</Label>
                        <Input
                          id="orders"
                          type="number"
                          value={formData.orders}
                          onChange={(e) =>
                            setFormData({ ...formData, orders: e.target.value })
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
                            setFormData({
                              ...formData,
                              revenue: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setOpenAddDialog(false)}
                        disabled={saving}
                      >
                        Отмена
                      </Button>
                      <Button onClick={handleAddStat} disabled={saving}>
                        {saving ? "Добавление..." : "Добавить"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {campaign.stats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Статистика не найдена
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Impressions</TableHead>
                    <TableHead>Clicks</TableHead>
                    <TableHead>CTR</TableHead>
                    <TableHead>CPC</TableHead>
                    <TableHead>Spend</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaign.stats.map((stat) => (
                    <TableRow key={stat.id}>
                      <TableCell>
                        {new Date(stat.date).toLocaleDateString("ru-RU")}
                      </TableCell>
                      <TableCell>{stat.impressions || "-"}</TableCell>
                      <TableCell>{stat.clicks || "-"}</TableCell>
                      <TableCell>
                        {calculateCTR(stat.impressions, stat.clicks)
                          ? `${calculateCTR(stat.impressions, stat.clicks)}%`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {calculateCPC(stat.clicks, stat.spend)
                          ? `${calculateCPC(stat.clicks, stat.spend)} ₽`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {stat.spend
                          ? `${stat.spend.toLocaleString("ru-RU")} ₽`
                          : "-"}
                      </TableCell>
                      <TableCell>{stat.orders || "-"}</TableCell>
                      <TableCell>
                        {stat.revenue
                          ? `${stat.revenue.toLocaleString("ru-RU")} ₽`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditStat(stat)}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Редактировать статистику</DialogTitle>
              <DialogDescription>
                Обновите данные за день
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editDate">Дата</Label>
                <Input
                  id="editDate"
                  type="date"
                  value={formData.date}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editImpressions">Impressions</Label>
                <Input
                  id="editImpressions"
                  type="number"
                  value={formData.impressions}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      impressions: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editClicks">Clicks</Label>
                <Input
                  id="editClicks"
                  type="number"
                  value={formData.clicks}
                  onChange={(e) =>
                    setFormData({ ...formData, clicks: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editSpend">Spend</Label>
                <Input
                  id="editSpend"
                  type="number"
                  step="0.01"
                  value={formData.spend}
                  onChange={(e) =>
                    setFormData({ ...formData, spend: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editOrders">Orders</Label>
                <Input
                  id="editOrders"
                  type="number"
                  value={formData.orders}
                  onChange={(e) =>
                    setFormData({ ...formData, orders: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editRevenue">Revenue</Label>
                <Input
                  id="editRevenue"
                  type="number"
                  step="0.01"
                  value={formData.revenue}
                  onChange={(e) =>
                    setFormData({ ...formData, revenue: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpenEditDialog(false)}
                disabled={saving}
              >
                Отмена
              </Button>
              <Button onClick={handleUpdateStat} disabled={saving}>
                {saving ? "Сохранение..." : "Сохранить"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

