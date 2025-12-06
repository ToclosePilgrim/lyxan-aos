"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";

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

export default function NewSupplierPage() {
  const router = useRouter();
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    types: ["MANUFACTURER"] as string[],
    status: "ACTIVE" as string,
    countryId: undefined as string | undefined,
    suppliesWhat: "",
    contactPerson: "",
    email: "",
    phone: "",
    website: "",
    tags: "",
    notes: "",
    // Generic legal details (for non-RU countries)
    genericLegal: {
      legalName: "",
      taxId: "",
      registrationNumber: "",
      legalAddress: "",
      bankDetails: "",
    },
    // Russian legal details (for RU)
    russianLegal: {
      legalName: "",
      inn: "",
      kpp: "",
      ogrn: "",
      legalAddress: "",
      actualAddress: "",
      // Bank details
      bankName: "",
      bic: "",
      bankAccount: "",
      correspondentAccount: "",
      bankExtraDetails: "",
      // Additional legal info
      edoSystem: "",
      edoNumber: "",
      ceoFullName: "",
    },
  });

  useEffect(() => {
    loadCountries();
  }, []);

  const loadCountries = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<Country[]>("/org/countries");
      setCountries(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load countries:", error);
      toast.error("Failed to load countries");
      setCountries([]);
    } finally {
      setLoading(false);
    }
  };

  // Get selected country code
  const selectedCountry = countries.find((c) => c.id === formData.countryId);
  const countryCode = selectedCountry?.code;
  const isRussia = countryCode === "RU";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!formData.types || formData.types.length === 0) {
      toast.error("At least one type must be selected");
      return;
    }

    try {
      setSaving(true);
      const payload: any = {
        name: formData.name,
        code: formData.code?.trim() || undefined, // Only send if not empty, backend will auto-generate
        types: formData.types,
        status: formData.status,
      };

      if (formData.countryId) {
        payload.countryId = formData.countryId;
        payload.countryCode = countryCode;
      }

      if (formData.suppliesWhat) payload.suppliesWhat = formData.suppliesWhat;
      if (formData.contactPerson) payload.contactPerson = formData.contactPerson;
      if (formData.email) payload.email = formData.email;
      if (formData.phone) payload.phone = formData.phone;
      if (formData.website) payload.website = formData.website;
      if (formData.tags) payload.tags = formData.tags.split(",").map((t) => t.trim()).filter(Boolean);
      if (formData.notes) payload.notes = formData.notes;

      // Add legal details based on country
      if (isRussia) {
        // Russian legal details
        if (
          formData.russianLegal.legalName ||
          formData.russianLegal.inn ||
          formData.russianLegal.legalAddress
        ) {
          payload.russianLegal = {
            legalName: formData.russianLegal.legalName || undefined,
            inn: formData.russianLegal.inn || undefined,
            kpp: formData.russianLegal.kpp || undefined,
            ogrn: formData.russianLegal.ogrn || undefined,
            legalAddress: formData.russianLegal.legalAddress || undefined,
            actualAddress: formData.russianLegal.actualAddress || undefined,
            // Bank details
            bankName: formData.russianLegal.bankName || undefined,
            bic: formData.russianLegal.bic || undefined,
            bankAccount: formData.russianLegal.bankAccount || undefined,
            correspondentAccount: formData.russianLegal.correspondentAccount || undefined,
            bankExtraDetails: formData.russianLegal.bankExtraDetails || undefined,
            // Additional legal info
            edoSystem: formData.russianLegal.edoSystem || undefined,
            edoNumber: formData.russianLegal.edoNumber || undefined,
            ceoFullName: formData.russianLegal.ceoFullName || undefined,
          };
        }
      } else if (countryCode) {
        // Generic legal details for non-RU countries
        if (
          formData.genericLegal.legalName ||
          formData.genericLegal.taxId ||
          formData.genericLegal.legalAddress
        ) {
          payload.legal = {
            legalName: formData.genericLegal.legalName || undefined,
            taxId: formData.genericLegal.taxId || undefined,
            registrationNumber: formData.genericLegal.registrationNumber || undefined,
            legalAddress: formData.genericLegal.legalAddress || undefined,
            bankDetails: formData.genericLegal.bankDetails || undefined,
          };
        }
      }

      const newSupplier = await apiRequest<{ id: string }>("/scm/suppliers", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success("Supplier created");
      router.push(`/scm/suppliers/${newSupplier.id}`);
    } catch (error: any) {
      console.error("Failed to create supplier:", error);
      let errorMessage = "Failed to create supplier";

      if (error?.response?.data) {
        const errorData = error.response.data;
        if (errorData.message) {
          if (Array.isArray(errorData.message)) {
            // Validation errors from class-validator
            const validationErrors = errorData.message
              .map((err: any) => {
                const field = Object.keys(err.constraints || {})[0];
                return `${err.property}: ${err.constraints?.[field] || "invalid"}`;
              })
              .join(", ");
            errorMessage = `Validation failed: ${validationErrors}`;
          } else if (typeof errorData.message === "string") {
            errorMessage = errorData.message;
          } else if (errorData.message.message) {
            errorMessage = errorData.message.message;
          }
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const formatSupplierType = (typeValue: string) => {
    const type = SUPPLIER_TYPES.find((t) => t.value === typeValue);
    return type ? type.label : typeValue;
  };

  const handleTypeToggle = (typeValue: string) => {
    const currentTypes = formData.types;
    if (currentTypes.includes(typeValue)) {
      // Remove type if already selected (but keep at least one)
      if (currentTypes.length > 1) {
        setFormData({
          ...formData,
          types: currentTypes.filter((t) => t !== typeValue),
        });
      } else {
        toast.error("At least one type must be selected");
      }
    } else {
      // Add type if not selected
      setFormData({
        ...formData,
        types: [...currentTypes, typeValue],
      });
    }
  };

  // Reset legal details when country changes
  const handleCountryChange = (countryId: string) => {
    setFormData({
      ...formData,
      countryId,
      // Reset legal details when switching countries
      genericLegal: {
        legalName: "",
        taxId: "",
        registrationNumber: "",
        legalAddress: "",
        bankDetails: "",
      },
      russianLegal: {
        legalName: "",
        inn: "",
        kpp: "",
        ogrn: "",
        legalAddress: "",
        actualAddress: "",
        // Bank details
        bankName: "",
        bic: "",
        bankAccount: "",
        correspondentAccount: "",
        bankExtraDetails: "",
        // Additional legal info
        edoSystem: "",
        edoNumber: "",
        ceoFullName: "",
      },
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create Supplier</h1>
            <p className="text-muted-foreground mt-2">
              Add a new supplier to the system
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name *
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="col-span-3"
                    required
                    disabled={saving}
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="code" className="text-right">
                    Code
                  </Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="col-span-3"
                    disabled={saving}
                  />
                </div>

                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="types" className="text-right pt-2">
                    Types *
                  </Label>
                  <div className="col-span-3 space-y-3">
                    <p className="text-sm text-muted-foreground mb-2">
                      Types (you can choose several)
                    </p>
                    {SUPPLIER_TYPES.map((type) => (
                      <div key={type.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`type-${type.value}`}
                          checked={formData.types.includes(type.value)}
                          onCheckedChange={() => handleTypeToggle(type.value)}
                          disabled={saving}
                        />
                        <Label
                          htmlFor={`type-${type.value}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {type.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="country" className="text-right">
                    Country
                  </Label>
                  <Select
                    value={formData.countryId}
                    onValueChange={handleCountryChange}
                    disabled={saving || loading}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select a country (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {(countries || []).map((country) => (
                        <SelectItem key={country.id} value={country.id}>
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="suppliesWhat" className="text-right pt-2">
                    Supplies what
                  </Label>
                  <Textarea
                    id="suppliesWhat"
                    value={formData.suppliesWhat}
                    onChange={(e) =>
                      setFormData({ ...formData, suppliesWhat: e.target.value })
                    }
                    className="col-span-3"
                    rows={3}
                    disabled={saving}
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="status" className="text-right">
                    Status
                  </Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                    disabled={saving}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPLIER_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contacts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="contactPerson" className="text-right">
                    Contact Person
                  </Label>
                  <Input
                    id="contactPerson"
                    value={formData.contactPerson}
                    onChange={(e) =>
                      setFormData({ ...formData, contactPerson: e.target.value })
                    }
                    className="col-span-3"
                    disabled={saving}
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="col-span-3"
                    disabled={saving}
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="phone" className="text-right">
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="col-span-3"
                    disabled={saving}
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="website" className="text-right">
                    Website
                  </Label>
                  <Input
                    id="website"
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="col-span-3"
                    disabled={saving}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Dynamic Legal Details Block */}
            {countryCode && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Legal Details{selectedCountry ? ` – ${selectedCountry.name}` : ""}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Fields depend on selected country
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isRussia ? (
                    // Russian Legal Details
                    <>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="ru-legalName" className="text-right">
                          Legal Name *
                        </Label>
                        <Input
                          id="ru-legalName"
                          value={formData.russianLegal.legalName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              russianLegal: {
                                ...formData.russianLegal,
                                legalName: e.target.value,
                              },
                            })
                          }
                          className="col-span-3"
                          required
                          disabled={saving}
                        />
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="inn" className="text-right">
                          INN *
                        </Label>
                        <Input
                          id="inn"
                          value={formData.russianLegal.inn}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              russianLegal: {
                                ...formData.russianLegal,
                                inn: e.target.value,
                              },
                            })
                          }
                          className="col-span-3"
                          required
                          disabled={saving}
                          placeholder="10 or 12 digits"
                        />
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="kpp" className="text-right">
                          KPP
                        </Label>
                        <Input
                          id="kpp"
                          value={formData.russianLegal.kpp}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              russianLegal: {
                                ...formData.russianLegal,
                                kpp: e.target.value,
                              },
                            })
                          }
                          className="col-span-3"
                          disabled={saving}
                          placeholder="9 digits"
                        />
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="ogrn" className="text-right">
                          OGRN
                        </Label>
                        <Input
                          id="ogrn"
                          value={formData.russianLegal.ogrn}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              russianLegal: {
                                ...formData.russianLegal,
                                ogrn: e.target.value,
                              },
                            })
                          }
                          className="col-span-3"
                          disabled={saving}
                          placeholder="13 or 15 digits"
                        />
                      </div>

                      <div className="grid grid-cols-4 items-start gap-4">
                        <Label htmlFor="ru-legalAddress" className="text-right pt-2">
                          Legal Address *
                        </Label>
                        <Textarea
                          id="ru-legalAddress"
                          value={formData.russianLegal.legalAddress}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              russianLegal: {
                                ...formData.russianLegal,
                                legalAddress: e.target.value,
                              },
                            })
                          }
                          className="col-span-3"
                          rows={3}
                          required
                          disabled={saving}
                        />
                      </div>

                      <div className="grid grid-cols-4 items-start gap-4">
                        <Label htmlFor="actualAddress" className="text-right pt-2">
                          Actual Address
                        </Label>
                        <Textarea
                          id="actualAddress"
                          value={formData.russianLegal.actualAddress}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              russianLegal: {
                                ...formData.russianLegal,
                                actualAddress: e.target.value,
                              },
                            })
                          }
                          className="col-span-3"
                          rows={3}
                          disabled={saving}
                        />
                      </div>

                      {/* Bank Details Section */}
                      <div className="col-span-4 border-t pt-4 mt-4">
                        <h4 className="text-sm font-semibold mb-4">Bank Details (Russia)</h4>
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="bankName" className="text-right">
                          Bank Name *
                        </Label>
                        <Input
                          id="bankName"
                          value={formData.russianLegal.bankName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              russianLegal: {
                                ...formData.russianLegal,
                                bankName: e.target.value,
                              },
                            })
                          }
                          className="col-span-3"
                          required
                          disabled={saving}
                          placeholder="e.g., ПАО Сбербанк"
                        />
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="bic" className="text-right">
                          BIC *
                        </Label>
                        <Input
                          id="bic"
                          value={formData.russianLegal.bic}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              russianLegal: {
                                ...formData.russianLegal,
                                bic: e.target.value,
                              },
                            })
                          }
                          className="col-span-3"
                          required
                          disabled={saving}
                          placeholder="9 digits"
                        />
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="bankAccount" className="text-right">
                          Bank Account (р/с) *
                        </Label>
                        <Input
                          id="bankAccount"
                          value={formData.russianLegal.bankAccount}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              russianLegal: {
                                ...formData.russianLegal,
                                bankAccount: e.target.value,
                              },
                            })
                          }
                          className="col-span-3"
                          required
                          disabled={saving}
                          placeholder="20 digits"
                        />
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="correspondentAccount" className="text-right">
                          Corr. Account (кор/с)
                        </Label>
                        <Input
                          id="correspondentAccount"
                          value={formData.russianLegal.correspondentAccount}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              russianLegal: {
                                ...formData.russianLegal,
                                correspondentAccount: e.target.value,
                              },
                            })
                          }
                          className="col-span-3"
                          disabled={saving}
                          placeholder="20 digits"
                        />
                      </div>

                      <div className="grid grid-cols-4 items-start gap-4">
                        <Label htmlFor="bankExtraDetails" className="text-right pt-2">
                          Extra Details
                        </Label>
                        <Textarea
                          id="bankExtraDetails"
                          value={formData.russianLegal.bankExtraDetails}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              russianLegal: {
                                ...formData.russianLegal,
                                bankExtraDetails: e.target.value,
                              },
                            })
                          }
                          className="col-span-3"
                          rows={3}
                          disabled={saving}
                          placeholder="Additional payment information"
                        />
                      </div>

                      {/* Additional Legal Info Section */}
                      <div className="col-span-4 border-t pt-4 mt-4">
                        <h4 className="text-sm font-semibold mb-4">Additional Legal Info</h4>
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edoSystem" className="text-right">
                          EDO System
                        </Label>
                        <Input
                          id="edoSystem"
                          value={formData.russianLegal.edoSystem}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              russianLegal: {
                                ...formData.russianLegal,
                                edoSystem: e.target.value,
                              },
                            })
                          }
                          className="col-span-3"
                          disabled={saving}
                          placeholder="e.g., СБИС, Диадок"
                        />
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edoNumber" className="text-right">
                          EDO Number
                        </Label>
                        <Input
                          id="edoNumber"
                          value={formData.russianLegal.edoNumber}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              russianLegal: {
                                ...formData.russianLegal,
                                edoNumber: e.target.value,
                              },
                            })
                          }
                          className="col-span-3"
                          disabled={saving}
                          placeholder="Адрес/ID в системе ЭДО"
                        />
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="ceoFullName" className="text-right">
                          CEO Full Name
                        </Label>
                        <Input
                          id="ceoFullName"
                          value={formData.russianLegal.ceoFullName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              russianLegal: {
                                ...formData.russianLegal,
                                ceoFullName: e.target.value,
                              },
                            })
                          }
                          className="col-span-3"
                          disabled={saving}
                          placeholder="Full name of General Director"
                        />
                      </div>
                    </>
                  ) : (
                    // Generic Legal Details (non-RU)
                    <>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="legalName" className="text-right">
                          Legal Name *
                        </Label>
                        <Input
                          id="legalName"
                          value={formData.genericLegal.legalName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              genericLegal: {
                                ...formData.genericLegal,
                                legalName: e.target.value,
                              },
                            })
                          }
                          className="col-span-3"
                          required
                          disabled={saving}
                        />
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="taxId" className="text-right">
                          Tax ID *
                        </Label>
                        <Input
                          id="taxId"
                          value={formData.genericLegal.taxId}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              genericLegal: {
                                ...formData.genericLegal,
                                taxId: e.target.value,
                              },
                            })
                          }
                          className="col-span-3"
                          required
                          disabled={saving}
                        />
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="registrationNumber" className="text-right">
                          Registration Number
                        </Label>
                        <Input
                          id="registrationNumber"
                          value={formData.genericLegal.registrationNumber}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              genericLegal: {
                                ...formData.genericLegal,
                                registrationNumber: e.target.value,
                              },
                            })
                          }
                          className="col-span-3"
                          disabled={saving}
                        />
                      </div>

                      <div className="grid grid-cols-4 items-start gap-4">
                        <Label htmlFor="legalAddress" className="text-right pt-2">
                          Legal Address *
                        </Label>
                        <Textarea
                          id="legalAddress"
                          value={formData.genericLegal.legalAddress}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              genericLegal: {
                                ...formData.genericLegal,
                                legalAddress: e.target.value,
                              },
                            })
                          }
                          className="col-span-3"
                          rows={3}
                          required
                          disabled={saving}
                        />
                      </div>

                      <div className="grid grid-cols-4 items-start gap-4">
                        <Label htmlFor="bankDetails" className="text-right pt-2">
                          Bank Details
                        </Label>
                        <Textarea
                          id="bankDetails"
                          value={formData.genericLegal.bankDetails}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              genericLegal: {
                                ...formData.genericLegal,
                                bankDetails: e.target.value,
                              },
                            })
                          }
                          className="col-span-3"
                          rows={3}
                          disabled={saving}
                          placeholder="Bank name, account number, SWIFT, etc."
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Meta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="tags" className="text-right">
                    Tags
                  </Label>
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="col-span-3"
                    placeholder="Comma-separated tags"
                    disabled={saving}
                  />
                </div>

                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="notes" className="text-right pt-2">
                    Notes
                  </Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="col-span-3"
                    rows={4}
                    disabled={saving}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/scm/suppliers")}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
