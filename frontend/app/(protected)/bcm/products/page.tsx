"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

interface Product {
  id: string;
  name: string;
  brand: {
    id: string;
    name: string;
  };
  marketplace: {
    id: string;
    name: string;
  } | null;
  skusCount: number;
  cardStatus: string;
  hasCard: boolean;
}

export default function BcmProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<Product[]>("/bcm/products");
      setProducts(data || []);
    } catch (error) {
      console.error("Failed to load products:", error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const getCardStatusBadge = (status: string) => {
    if (status === "Complete") {
      return (
        <span className="text-green-600 font-medium">✓ Complete</span>
      );
    } else if (status === "Needs work") {
      return (
        <span className="text-orange-600 font-medium">Needs work</span>
      );
    } else {
      return (
        <span className="text-gray-500">No card</span>
      );
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Listings</h1>
            <p className="text-muted-foreground mt-2">
              Manage marketplace listings
            </p>
          </div>
          <Button asChild>
            <Link href="/bcm/products/new">Create Listing</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Listings</CardTitle>
            <CardDescription>
              {products.length} listing(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : products.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No listings found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Listing Name</TableHead>
                    <TableHead>SKU Count</TableHead>
                    <TableHead>Marketplace</TableHead>
                    <TableHead>Published Status</TableHead>
                    <TableHead>Card Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(products || []).map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell>{product.skusCount}</TableCell>
                      <TableCell>
                        {product.marketplace?.name || "-"}
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground">-</span>
                      </TableCell>
                      <TableCell>
                        {getCardStatusBadge(product.cardStatus)}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/bcm/products/${product.id}`}>
                            View Listing
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

