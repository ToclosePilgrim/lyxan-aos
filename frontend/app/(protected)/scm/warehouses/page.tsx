"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface Warehouse {
  id: string;
  name: string;
  code: string;
  type: string;
  countryId: string | null;
  country: {
    id: string;
    name: string;
    code: string;
  } | null;
  city: string | null;
  address: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  stocksCount: number;
  suppliesCount: number;
}

interface WarehouseListResponse {
  items: Warehouse[];
  total: number;
}

const WAREHOUSE_TYPE_LABELS: Record<string, string> = {
  OWN: "Own",
  MANUFACTURER: "Manufacturer",
  THIRD_PARTY: "Third Party",
};

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);

  useEffect(() => {
    loadWarehouses();
  }, [search, activeOnly]);

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (activeOnly) params.append("isActive", "true");
      params.append("limit", "100");

      const query = params.toString();
      const endpoint = `/scm/warehouses${query ? `?${query}` : ""}`;
      const data = await apiRequest<WarehouseListResponse>(endpoint);
      setWarehouses(data.items || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Failed to load warehouses:", error);
      toast.error("Failed to load warehouses");
      setWarehouses([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this warehouse?")) {
      return;
    }

    try {
      await apiRequest(`/scm/warehouses/${id}`, {
        method: "DELETE",
      });
      toast.success("Warehouse deactivated");
      loadWarehouses();
    } catch (error: any) {
      console.error("Failed to deactivate warehouse:", error);
      toast.error("Failed to deactivate warehouse", {
        description: error.message || "Unknown error",
      });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Warehouses</h1>
            <p className="text-muted-foreground mt-2">
              Manage warehouses and locations
            </p>
          </div>
          <Link href="/scm/warehouses/new">
            <Button>New Warehouse</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter warehouses by name, code, or status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  placeholder="Search by name or code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 pt-8">
                <Checkbox
                  id="active-only"
                  checked={activeOnly}
                  onCheckedChange={(checked) => setActiveOnly(checked === true)}
                />
                <Label htmlFor="active-only">Active only</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Warehouses ({total})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading warehouses...
              </div>
            ) : warehouses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No warehouses found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {warehouses.map((warehouse) => (
                      <TableRow
                        key={warehouse.id}
                        className="cursor-pointer"
                        onClick={() => {
                          window.location.href = `/scm/warehouses/${warehouse.id}`;
                        }}
                      >
                        <TableCell className="font-medium">
                          {warehouse.code}
                        </TableCell>
                        <TableCell>{warehouse.name}</TableCell>
                        <TableCell>
                          {warehouse.country?.name || "-"}
                        </TableCell>
                        <TableCell>{warehouse.city || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {WAREHOUSE_TYPE_LABELS[warehouse.type] || warehouse.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {warehouse.isActive ? (
                            <Badge className="bg-green-500">Yes</Badge>
                          ) : (
                            <Badge variant="outline">No</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <Link href={`/scm/warehouses/${warehouse.id}`}>
                              <Button variant="outline" size="sm">
                                Edit
                              </Button>
                            </Link>
                            {warehouse.isActive && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(warehouse.id)}
                              >
                                Deactivate
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
