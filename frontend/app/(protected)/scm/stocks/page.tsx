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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";
import { format } from "date-fns";
import Link from "next/link";

interface Stock {
  id: string;
  warehouseId: string;
  warehouse: {
    id: string;
    name: string;
    code: string;
    type: string;
  };
  scmProductId: string | null;
  scmProduct: {
    id: string;
    internalName: string;
    sku: string | null;
  } | null;
  supplierItemId: string | null;
  supplierItem: {
    id: string;
    name: string;
    code: string;
    type: string;
    category: string;
    unit: string;
    supplier: {
      id: string;
      name: string;
      code: string;
    };
  } | null;
  quantity: number;
  unit: string;
  createdAt: string;
  updatedAt: string;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface InventoryBalance {
  id: string;
  warehouseId: string;
  productId: string | null;
  product: {
    id: string;
    name: string;
  } | null;
  supplierItemId: string | null;
  supplierItem: {
    id: string;
    name: string;
    code: string;
    type: string;
    category: string;
    unit: string;
    supplier: {
      id: string;
      name: string;
      code: string;
    };
  } | null;
  quantity: number;
  updatedAt: string;
}

const WAREHOUSE_TYPE_LABELS: Record<string, string> = {
  MAIN: "Main",
  PRODUCTION: "Production",
  STORAGE: "Storage",
  TEMPORARY: "Temporary",
};

export default function StocksPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [inventoryBalances, setInventoryBalances] = useState<InventoryBalance[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("scm-stocks");

  useEffect(() => {
    loadWarehouses();
  }, []);

  useEffect(() => {
    if (activeTab === "scm-stocks") {
      loadStocks();
    } else if (activeTab === "inventory" && selectedWarehouseId !== "ALL") {
      loadInventoryBalances();
    }
  }, [selectedWarehouseId, activeTab]);

  const loadWarehouses = async () => {
    try {
      const data = await apiRequest<{ items: Warehouse[]; total: number }>(
        "/scm/warehouses?isActive=true&limit=100"
      );
      setWarehouses(Array.isArray(data.items) ? data.items.filter(w => w?.id) : []);
    } catch (error) {
      console.error("Failed to load warehouses:", error);
      setWarehouses([]);
    }
  };

  const loadStocks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedWarehouseId !== "ALL") {
        params.append("warehouseId", selectedWarehouseId);
      }
      const queryString = params.toString();
      const url = `/scm/stocks${queryString ? `?${queryString}` : ""}`;
      const data = await apiRequest<Stock[]>(url);
      setStocks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load stocks:", error);
      setStocks([]);
    } finally {
      setLoading(false);
    }
  };

  const loadInventoryBalances = async () => {
    if (selectedWarehouseId === "ALL") {
      setInventoryBalances([]);
      return;
    }

    try {
      setLoading(true);
      const data = await apiRequest<InventoryBalance[]>(
        `/inventory/warehouses/${selectedWarehouseId}/balances`
      );
      setInventoryBalances(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load inventory balances:", error);
      setInventoryBalances([]);
    } finally {
      setLoading(false);
    }
  };

  const getProductName = (stock: Stock): string => {
    if (stock.scmProduct) {
      return stock.scmProduct.internalName + (stock.scmProduct.sku ? ` [${stock.scmProduct.sku}]` : "");
    }
    if (stock.supplierItem) {
      return stock.supplierItem.name + (stock.supplierItem.code ? ` [${stock.supplierItem.code}]` : "");
    }
    return "Unknown";
  };

  const getInventoryItemName = (balance: InventoryBalance): string => {
    if (balance.product) {
      return balance.product.name;
    }
    if (balance.supplierItem) {
      return `${balance.supplierItem.name} [${balance.supplierItem.code}]`;
    }
    return "Unknown";
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Stocks</h1>
            <p className="text-muted-foreground mt-2">
              Manage warehouse inventory
            </p>
          </div>
          <Link href="/scm/warehouses" className="text-sm text-muted-foreground hover:text-foreground">
            Manage Warehouses
          </Link>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="scm-stocks">SCM Stocks</TabsTrigger>
            <TabsTrigger value="inventory">Inventory Balances</TabsTrigger>
          </TabsList>

          <TabsContent value="scm-stocks">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Current Stock</CardTitle>
                  <div className="flex gap-2">
                    <Select
                      value={selectedWarehouseId}
                      onValueChange={setSelectedWarehouseId}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select Warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Warehouses</SelectItem>
                        {warehouses.map((warehouse) => (
                          <SelectItem key={warehouse.id} value={warehouse.id}>
                            {warehouse.code} — {warehouse.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : stocks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No stocks found for the selected criteria.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product / Item</TableHead>
                        {selectedWarehouseId === "ALL" && (
                          <TableHead>Warehouse</TableHead>
                        )}
                        <TableHead>Quantity</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Last Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stocks.map((stock) => (
                        <TableRow key={stock.id}>
                          <TableCell className="font-medium">
                            {getProductName(stock)}
                          </TableCell>
                          {selectedWarehouseId === "ALL" && (
                            <TableCell>
                              <Badge variant="outline">
                                {stock.warehouse.name} (
                                {WAREHOUSE_TYPE_LABELS[stock.warehouse.type] || stock.warehouse.type})
                              </Badge>
                            </TableCell>
                          )}
                          <TableCell>{stock.quantity}</TableCell>
                          <TableCell>{stock.unit}</TableCell>
                          <TableCell>
                            {format(new Date(stock.updatedAt), "PPP p")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Inventory Balances</CardTitle>
                  <Select
                    value={selectedWarehouseId}
                    onValueChange={setSelectedWarehouseId}
                  >
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Select Warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.name} ({WAREHOUSE_TYPE_LABELS[warehouse.type] || warehouse.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <CardDescription>
                  Current inventory balances by warehouse
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedWarehouseId === "ALL" ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Please select a warehouse to view inventory balances.
                  </div>
                ) : loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : inventoryBalances.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No inventory balances found for this warehouse.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product / Item</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Last Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventoryBalances.map((balance) => (
                        <TableRow key={balance.id}>
                          <TableCell className="font-medium">
                            {getInventoryItemName(balance)}
                            {balance.supplierItem && (
                              <div className="text-sm text-muted-foreground">
                                Supplier: {balance.supplierItem.supplier.name}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{balance.quantity}</TableCell>
                          <TableCell>
                            {balance.supplierItem?.unit || "N/A"}
                          </TableCell>
                          <TableCell>
                            {format(new Date(balance.updatedAt), "PPP p")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
