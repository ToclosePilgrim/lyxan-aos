"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";

interface Country {
  id: string;
  name: string;
  code: string;
}

const WAREHOUSE_TYPES = [
  { value: "OWN", label: "Own" },
  { value: "MANUFACTURER", label: "Manufacturer" },
  { value: "THIRD_PARTY", label: "Third Party" },
] as const;

export default function NewWarehousePage() {
  const router = useRouter();
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "OWN" as string,
    countryId: undefined as string | undefined,
    city: "",
    address: "",
    notes: "",
    isActive: true,
  });

  useEffect(() => {
    loadCountries();
  }, []);

  const loadCountries = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<Country[]>("/org/countries?limit=100");
      setCountries(Array.isArray(data) ? data.filter(c => c?.id) : []);
    } catch (error) {
      console.error("Failed to load countries:", error);
      toast.error("Failed to load countries");
      setCountries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!formData.code.trim()) {
      toast.error("Code is required");
      return;
    }

    try {
      setSaving(true);
      const payload: any = {
        name: formData.name,
        code: formData.code,
        type: formData.type,
        isActive: formData.isActive,
      };

      if (formData.countryId) payload.countryId = formData.countryId;
      if (formData.city) payload.city = formData.city;
      if (formData.address) payload.address = formData.address;
      if (formData.notes) payload.notes = formData.notes;

      await apiRequest("/scm/warehouses", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success("Warehouse created successfully");
      router.push("/scm/warehouses");
    } catch (error: any) {
      console.error("Failed to create warehouse:", error);
      toast.error("Failed to create warehouse", {
        description: error.message || "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-8 text-muted-foreground">
          Loading...
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Warehouse</h1>
          <p className="text-muted-foreground mt-2">
            Create a new warehouse
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Warehouse Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    placeholder="WH-001"
                    maxLength={50}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Main Factory Warehouse"
                    maxLength={255}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WAREHOUSE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Select
                    value={formData.countryId || ""}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        countryId: value || undefined,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {countries.filter(c => c?.id).map((country) => (
                        <SelectItem key={country.id} value={String(country.id)}>
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                  placeholder="Moscow"
                />
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="Street address"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Additional notes"
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isActive: checked === true })
                  }
                />
                <Label htmlFor="isActive">Active</Label>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Creating..." : "Create Warehouse"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </MainLayout>
  );
}

