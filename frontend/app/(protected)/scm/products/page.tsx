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

interface ScmProduct {
  id: string;
  internalName: string;
  sku: string | null;
  brand: {
    id: string;
    name: string;
    code: string;
  } | null;
  baseDescription: string | null;
  composition: string | null;
  createdAt: string;
  updatedAt: string;
  listingsCount: number;
}

interface Brand {
  id: string;
  name: string;
  code: string;
}

export default function ScmProductsPage() {
  const [products, setProducts] = useState<ScmProduct[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState<string | undefined>(undefined);

  useEffect(() => {
    loadBrands();
    loadProducts();
  }, []);

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, selectedBrandId]);

  const loadBrands = async () => {
    try {
      const data = await apiRequest<Brand[]>("/bcm/brands");
      setBrands(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load brands:", error);
      toast.error("Failed to load brands");
      setBrands([]);
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (selectedBrandId) params.append("brandId", selectedBrandId);

      const query = params.toString();
      const endpoint = `/scm/products${query ? `?${query}` : ""}`;
      const data = await apiRequest<ScmProduct[]>(endpoint);
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load SCM products:", error);
      toast.error("Failed to load SCM products", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">SCM Products</h1>
            <p className="text-muted-foreground mt-2">
              Internal products (SKU) for supply chain management
            </p>
          </div>
          <Button asChild>
            <Link href="/scm/products/new">Create SCM Product</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="Search by internal name or SKU"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadProducts()}
                className="flex-1"
              />
              <Select value={selectedBrandId || "ALL"} onValueChange={(value) => setSelectedBrandId(value === "ALL" ? undefined : value)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All brands" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All brands</SelectItem>
                  {(brands || []).map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={loadProducts}>Search</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SCM Products</CardTitle>
            <CardDescription>
              {products.length} product(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : products.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No SCM products found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Internal Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Listings</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(products || []).map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        {product.internalName}
                      </TableCell>
                      <TableCell>{product.sku || "-"}</TableCell>
                      <TableCell>{product.brand?.name || "-"}</TableCell>
                      <TableCell>{product.listingsCount}</TableCell>
                      <TableCell>
                        {new Date(product.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/scm/products/${product.id}`}>
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
