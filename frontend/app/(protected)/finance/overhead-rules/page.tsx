"use client";

import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";

type Method = "PER_UNIT" | "PER_ORDER" | "PERCENT_OF_MATERIAL_COST";
type Scope = "GLOBAL" | "BRAND" | "COUNTRY" | "ITEM" | "CATEGORY" | "SUPPLY" | "PRODUCTION_ORDER";

interface Rule {
  id: string;
  name: string;
  description?: string | null;
  method: Method;
  rate: string;
  currency?: string | null;
  scope: Scope;
  brandId?: string | null;
  countryId?: string | null;
  itemId?: string | null;
  categoryId?: string | null;
  isActive: boolean;
  createdAt: string;
}

const METHODS: Method[] = ["PER_UNIT", "PER_ORDER", "PERCENT_OF_MATERIAL_COST"];
const SCOPES: Scope[] = ["GLOBAL", "BRAND", "COUNTRY", "ITEM", "CATEGORY", "SUPPLY", "PRODUCTION_ORDER"];
const NEED_TARGET: Partial<Record<Scope, string>> = {
  BRAND: "brandId",
  COUNTRY: "countryId",
  ITEM: "itemId",
  CATEGORY: "categoryId",
};

export default function OverheadRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    method: "PER_UNIT" as Method,
    rate: "",
    currency: "RUB",
    scope: "GLOBAL" as Scope,
    brandId: "",
    countryId: "",
    itemId: "",
    categoryId: "",
  });

  const currentTargetKey = useMemo(() => NEED_TARGET[form.scope], [form.scope]);

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<Rule[]>("/finance/overhead-rules");
      setRules(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load overhead rules:", error);
      toast.error("Failed to load overhead rules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      description: "",
      method: "PER_UNIT",
      rate: "",
      currency: "RUB",
      scope: "GLOBAL",
      brandId: "",
      countryId: "",
      itemId: "",
      categoryId: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (rule: Rule) => {
    setEditing(rule);
    setForm({
      name: rule.name,
      description: rule.description ?? "",
      method: rule.method,
      rate: rule.rate?.toString?.() ?? String(rule.rate ?? ""),
      currency: rule.currency ?? "",
      scope: rule.scope,
      brandId: rule.brandId ?? "",
      countryId: rule.countryId ?? "",
      itemId: rule.itemId ?? "",
      categoryId: rule.categoryId ?? "",
    });
    setDialogOpen(true);
  };

  const saveRule = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!form.rate || isNaN(Number(form.rate))) {
      toast.error("Rate must be a number");
      return;
    }
    if ((form.method === "PER_UNIT" || form.method === "PER_ORDER") && !form.currency) {
      toast.error("Currency is required for this method");
      return;
    }
    if (currentTargetKey && !(form as any)[currentTargetKey]) {
      toast.error(`${currentTargetKey} is required for this scope`);
      return;
    }

    const payload: any = {
      name: form.name,
      description: form.description || undefined,
      method: form.method,
      rate: Number(form.rate),
      currency: form.currency || undefined,
      scope: form.scope,
      brandId: form.brandId || undefined,
      countryId: form.countryId || undefined,
      itemId: form.itemId || undefined,
      categoryId: form.categoryId || undefined,
    };

    try {
      setSaving(true);
      if (editing) {
        await apiRequest(`/finance/overhead-rules/${editing.id}`, {
          method: "PATCH",
          body: payload,
        });
        toast.success("Rule updated");
      } else {
        await apiRequest(`/finance/overhead-rules`, {
          method: "POST",
          body: payload,
        });
        toast.success("Rule created");
      }
      setDialogOpen(false);
      await loadRules();
    } catch (error: any) {
      console.error("Failed to save rule:", error);
      toast.error("Failed to save rule", { description: error?.message });
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (rule: Rule) => {
    if (!confirm("Deactivate this rule?")) return;
    try {
      await apiRequest(`/finance/overhead-rules/${rule.id}`, { method: "DELETE" });
      toast.success("Rule deactivated");
      await loadRules();
    } catch (error: any) {
      console.error("Failed to deactivate rule:", error);
      toast.error("Failed to deactivate rule", { description: error?.message });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Overhead Rules</h1>
            <p className="text-sm text-muted-foreground">
              Configure overhead allocation rules for future cost calculations.
            </p>
          </div>
          <Button onClick={openCreate}>Create rule</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Rules</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : rules.length === 0 ? (
              <div className="text-sm text-muted-foreground">No rules yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => {
                      const target =
                        rule.scope === "BRAND"
                          ? rule.brandId
                          : rule.scope === "COUNTRY"
                          ? rule.countryId
                          : rule.scope === "ITEM"
                          ? rule.itemId
                          : rule.scope === "CATEGORY"
                          ? rule.categoryId
                          : "-";
                      return (
                        <TableRow key={rule.id}>
                          <TableCell>{rule.name}</TableCell>
                          <TableCell>{rule.method}</TableCell>
                          <TableCell>
                            {rule.rate} {rule.currency ?? ""}
                          </TableCell>
                          <TableCell>{rule.scope}</TableCell>
                          <TableCell>{target || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={rule.isActive ? "default" : "secondary"}>
                              {rule.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button size="sm" variant="outline" onClick={() => openEdit(rule)}>
                              Edit
                            </Button>
                            {rule.isActive && (
                              <Button size="sm" variant="destructive" onClick={() => deactivate(rule)}>
                                Deactivate
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit rule" : "Create rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Method</Label>
                <Select
                  value={form.method}
                  onValueChange={(value) =>
                    setForm((p) => ({ ...p, method: value as Method }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rate</Label>
                <Input
                  type="number"
                  value={form.rate}
                  onChange={(e) => setForm((p) => ({ ...p, rate: e.target.value }))}
                />
              </div>
              {(form.method === "PER_UNIT" || form.method === "PER_ORDER") && (
                <div>
                  <Label>Currency</Label>
                  <Input
                    value={form.currency}
                    onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Scope</Label>
                <Select
                  value={form.scope}
                  onValueChange={(value) =>
                    setForm((p) => ({ ...p, scope: value as Scope }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {currentTargetKey && (
                <div>
                  <Label>{currentTargetKey}</Label>
                  <Input
                    value={(form as any)[currentTargetKey] || ""}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        [currentTargetKey]: e.target.value,
                      }))
                    }
                    placeholder="ID"
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveRule} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

