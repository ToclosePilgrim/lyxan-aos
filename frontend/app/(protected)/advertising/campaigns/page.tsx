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
import Link from "next/link";

interface Marketplace {
  id: string;
  name: string;
  code: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  budget: number | null;
  totalSpend: number;
  totalRevenue: number;
  totalOrders: number;
  marketplace: {
    id: string;
    name: string;
    code: string;
  };
}

export default function AdvertisingCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [filters, setFilters] = useState({
    status: "",
    search: "",
  });

  const [formData, setFormData] = useState({
    marketplaceId: "",
    name: "",
    status: "ACTIVE",
    budget: "",
  });

  useEffect(() => {
    loadCampaigns();
    loadMarketplaces();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.search) params.append("search", filters.search);

      const query = params.toString();
      const endpoint = `/advertising/campaigns${query ? `?${query}` : ""}`;
      const data = await apiRequest<Campaign[]>(endpoint);
      setCampaigns(data || []);
    } catch (error) {
      console.error("Failed to load campaigns:", error);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMarketplaces = async () => {
    try {
      const data = await apiRequest<Marketplace[]>(`/org/marketplaces`);
      setMarketplaces(data || []);
    } catch (error) {
      console.error("Failed to load marketplaces:", error);
    }
  };

  const handleApplyFilters = () => {
    loadCampaigns();
  };

  const handleCreateCampaign = async () => {
    try {
      setSaving(true);
      await apiRequest(`/advertising/campaigns`, {
        method: "POST",
        body: JSON.stringify({
          marketplaceId: formData.marketplaceId,
          name: formData.name,
          status: formData.status,
          budget: formData.budget ? parseFloat(formData.budget) : undefined,
        }),
      });

      setFormData({
        marketplaceId: "",
        name: "",
        status: "ACTIVE",
        budget: "",
      });
      setOpenDialog(false);
      loadCampaigns();
      alert("Кампания создана");
    } catch (error: any) {
      console.error("Failed to create campaign:", error);
      alert(error.message || "Ошибка при создании кампании");
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "text-green-600";
      case "PAUSED":
        return "text-yellow-600";
      case "STOPPED":
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
            <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
            <p className="text-muted-foreground mt-2">
              Рекламные кампании
            </p>
          </div>
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button>Создать кампанию</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Создать кампанию</DialogTitle>
                <DialogDescription>
                  Введите данные о новой рекламной кампании
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="marketplace">Marketplace</Label>
                  <Select
                    value={formData.marketplaceId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, marketplaceId: value })
                    }
                  >
                    <SelectTrigger id="marketplace">
                      <SelectValue placeholder="Выберите маркетплейс" />
                    </SelectTrigger>
                    <SelectContent>
                      {marketplaces.map((mp) => (
                        <SelectItem key={mp.id} value={mp.id}>
                          {mp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Название</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Статус</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                      <SelectItem value="PAUSED">PAUSED</SelectItem>
                      <SelectItem value="STOPPED">STOPPED</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget">Budget</Label>
                  <Input
                    id="budget"
                    type="number"
                    step="0.01"
                    value={formData.budget}
                    onChange={(e) =>
                      setFormData({ ...formData, budget: e.target.value })
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
                <Button onClick={handleCreateCampaign} disabled={saving}>
                  {saving ? "Создание..." : "Создать"}
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
                <Label htmlFor="statusFilter">Статус</Label>
                <Select
                  value={filters.status}
                  onValueChange={(value) =>
                    setFilters({ ...filters, status: value })
                  }
                >
                  <SelectTrigger id="statusFilter" className="w-48">
                    <SelectValue placeholder="Все статусы" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Все статусы</SelectItem>
                    <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                    <SelectItem value="PAUSED">PAUSED</SelectItem>
                    <SelectItem value="STOPPED">STOPPED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex-1">
                <Label htmlFor="search">Поиск по названию</Label>
                <Input
                  id="search"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters({ ...filters, search: e.target.value })
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleApplyFilters}>Применить</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Кампании</CardTitle>
            <CardDescription>
              {campaigns.length} кампаний
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Загрузка...</div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Кампании не найдены
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Marketplace</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Total Spend</TableHead>
                    <TableHead>Total Revenue</TableHead>
                    <TableHead>Total Orders</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">
                        {campaign.name}
                      </TableCell>
                      <TableCell>{campaign.marketplace.name}</TableCell>
                      <TableCell>
                        <span className={getStatusColor(campaign.status)}>
                          {campaign.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {campaign.budget
                          ? `${campaign.budget.toLocaleString("ru-RU")} ₽`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {campaign.totalSpend.toLocaleString("ru-RU")} ₽
                      </TableCell>
                      <TableCell>
                        {campaign.totalRevenue.toLocaleString("ru-RU")} ₽
                      </TableCell>
                      <TableCell>{campaign.totalOrders}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/advertising/campaigns/${campaign.id}`}>
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

