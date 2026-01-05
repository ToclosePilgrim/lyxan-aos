"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";

type CurrencyRate = {
  id: string;
  currency: string;
  rateDate: string;
  rateToBase: number;
  source?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export default function CurrencyRatesPage() {
  const [baseCurrency, setBaseCurrency] = useState<string>("USD");
  const [rates, setRates] = useState<CurrencyRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterCurrency, setFilterCurrency] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [formCurrency, setFormCurrency] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formRate, setFormRate] = useState("");
  const [formSource, setFormSource] = useState("");
  const [saving, setSaving] = useState(false);

  const loadBaseCurrency = async () => {
    try {
      const res = await apiRequest<{ baseCurrency: string }>("/finance/currency-rates/base-currency");
      if (res?.baseCurrency) setBaseCurrency(res.baseCurrency);
    } catch (err) {
      console.error("Failed to load base currency", err);
    }
  };

  const loadRates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCurrency) params.append("currency", filterCurrency);
      if (filterFrom) params.append("fromDate", filterFrom);
      if (filterTo) params.append("toDate", filterTo);
      const url = `/finance/currency-rates${params.toString() ? `?${params.toString()}` : ""}`;
      const data = await apiRequest<CurrencyRate[]>(url);
      setRates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load currency rates", err);
      toast.error("Failed to load currency rates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBaseCurrency();
    loadRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyFilters = async () => {
    await loadRates();
  };

  const resetForm = () => {
    setFormCurrency("");
    setFormDate("");
    setFormRate("");
    setFormSource("");
  };

  const handleSave = async () => {
    if (!formCurrency || !formDate || !formRate) {
      toast.error("Currency, date, and rate are required");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/finance/currency-rates", {
        method: "POST",
        body: JSON.stringify({
          currency: formCurrency.toUpperCase(),
          rateDate: formDate,
          rateToBase: parseFloat(formRate),
          source: formSource || undefined,
        }),
      });
      toast.success("Rate saved");
      setModalOpen(false);
      resetForm();
      await loadRates();
    } catch (err: any) {
      console.error("Failed to save rate", err);
      toast.error("Failed to save rate", { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Currency Rates</h1>
            <p className="text-muted-foreground">
              Base currency: <span className="font-semibold">{baseCurrency}</span>
            </p>
          </div>
          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogTrigger asChild>
              <Button>Add / Update rate</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add or update currency rate</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Currency (ISO 4217)</Label>
                  <Input
                    value={formCurrency}
                    onChange={(e) => setFormCurrency(e.target.value.toUpperCase())}
                    placeholder="EUR"
                    maxLength={3}
                  />
                </div>
                <div>
                  <Label>Rate date (UTC)</Label>
                  <Input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Rate to base ({baseCurrency})</Label>
                  <Input
                    type="number"
                    step="0.000001"
                    value={formRate}
                    onChange={(e) => setFormRate(e.target.value)}
                    placeholder="1.100000"
                  />
                </div>
                <div>
                  <Label>Source (optional)</Label>
                  <Input
                    value={formSource}
                    onChange={(e) => setFormSource(e.target.value)}
                    placeholder="manual"
                  />
                </div>
              </div>
              <DialogFooter className="sm:justify-end">
                <Button variant="outline" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter rates by currency and date range</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div>
              <Label>Currency</Label>
              <Input
                placeholder="EUR"
                value={filterCurrency}
                maxLength={3}
                onChange={(e) => setFilterCurrency(e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <Label>From date</Label>
              <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
            </div>
            <div>
              <Label>To date</Label>
              <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={handleApplyFilters} disabled={loading}>
                {loading ? "Loading..." : "Apply"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rates</CardTitle>
            <CardDescription>Showing up to 1000 records</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Currency</TableHead>
                  <TableHead>Rate date (UTC)</TableHead>
                  <TableHead>Rate to base ({baseCurrency})</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No rates found
                    </TableCell>
                  </TableRow>
                ) : (
                  rates.map((rate) => (
                    <TableRow key={rate.id}>
                      <TableCell className="font-semibold">{rate.currency}</TableCell>
                      <TableCell>
                        {rate.rateDate ? format(new Date(rate.rateDate), "yyyy-MM-dd") : "—"}
                      </TableCell>
                      <TableCell>{rate.rateToBase}</TableCell>
                      <TableCell>{rate.source || "—"}</TableCell>
                      <TableCell>
                        {rate.updatedAt ? format(new Date(rate.updatedAt), "yyyy-MM-dd HH:mm") : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}






