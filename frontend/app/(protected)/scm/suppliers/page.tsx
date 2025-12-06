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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";

interface Supplier {
  id: string;
  name: string;
  code: string | null;
  types: string[];
  status: string;
  country: {
    id: string;
    name: string;
    code: string;
  } | null;
  suppliesWhat: string | null;
  productsCount: number;
}

interface Country {
  id: string;
  name: string;
  code: string;
}

const SUPPLIER_TYPES = [
  { value: "MANUFACTURER", label: "Manufacturer" },
  { value: "COMPONENT_SUPPLIER", label: "Component Supplier" },
  { value: "PACKAGING_SUPPLIER", label: "Packaging Supplier" },
  { value: "PRINTING_HOUSE", label: "Printing House" },
  { value: "OTHER", label: "Other" },
] as const;

const SUPPLIER_STATUSES = ["ACTIVE", "INACTIVE", "ONBOARDING"] as const;

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string | undefined>(undefined);
  const [selectedCountryId, setSelectedCountryId] = useState<string | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);

  useEffect(() => {
    loadCountries();
    loadSuppliers();
  }, []);

  useEffect(() => {
    loadSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, selectedType, selectedCountryId, selectedStatus]);

  const loadCountries = async () => {
    try {
      const data = await apiRequest<Country[]>("/org/countries");
      setCountries(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load countries:", error);
      toast.error("Failed to load countries");
      setCountries([]);
    }
  };

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (selectedType) params.append("type", selectedType);
      if (selectedCountryId) params.append("countryId", selectedCountryId);
      if (selectedStatus) params.append("status", selectedStatus);

      const query = params.toString();
      const endpoint = `/scm/suppliers${query ? `?${query}` : ""}`;
      const data = await apiRequest<Supplier[]>(endpoint);
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load suppliers:", error);
      toast.error("Failed to load suppliers", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  const formatSupplierType = (typeValue: string) => {
    const type = SUPPLIER_TYPES.find((t) => t.value === typeValue);
    return type ? type.label : typeValue;
  };

  const formatSupplierTypes = (types: string[]) => {
    if (!types || types.length === 0) return "-";
    return types.map((t) => formatSupplierType(t)).join(", ");
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
            <p className="text-muted-foreground mt-2">
              Manage suppliers for SCM products and purchases
            </p>
          </div>
          <Button asChild>
            <Link href="/scm/suppliers/new">Create Supplier</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              <Input
                placeholder="Search by name, code, or tags"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadSuppliers()}
                className="flex-1 min-w-[200px]"
              />
              <Select
                value={selectedType || "ALL"}
                onValueChange={(value) => setSelectedType(value === "ALL" ? undefined : value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All types</SelectItem>
                  {SUPPLIER_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedCountryId || "ALL"}
                onValueChange={(value) => setSelectedCountryId(value === "ALL" ? undefined : value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All countries</SelectItem>
                  {(countries || []).map((country) => (
                    <SelectItem key={country.id} value={country.id}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedStatus || "ALL"}
                onValueChange={(value) => setSelectedStatus(value === "ALL" ? undefined : value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  {SUPPLIER_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={loadSuppliers}>Search</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suppliers</CardTitle>
            <CardDescription>
              {suppliers.length} supplier(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : suppliers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No suppliers found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Supplies what</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(suppliers || []).map((supplier) => (
                    <TableRow
                      key={supplier.id}
                      className="cursor-pointer"
                      onClick={() => (window.location.href = `/scm/suppliers/${supplier.id}`)}
                    >
                      <TableCell className="font-medium">
                        {supplier.name}
                      </TableCell>
                      <TableCell>{formatSupplierTypes(supplier.types)}</TableCell>
                      <TableCell>{supplier.country?.name || "-"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {supplier.suppliesWhat || "-"}
                      </TableCell>
                      <TableCell>{supplier.status}</TableCell>
                      <TableCell>{supplier.productsCount}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/scm/suppliers/${supplier.id}`}>
                            View
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


