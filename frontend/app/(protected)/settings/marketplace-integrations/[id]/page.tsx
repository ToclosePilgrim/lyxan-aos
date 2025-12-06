"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { t } from "@/lib/i18n";

interface MarketplaceIntegration {
  id: string;
  name: string;
  marketplace: {
    id: string;
    code: string;
    name: string;
  };
  brand: {
    id: string;
    name: string;
  };
  country: {
    id: string;
    code: string;
    name: string;
  };
  status: "ACTIVE" | "INACTIVE" | "ERROR";
  lastSyncAt: string | null;
  credentials: {
    ozonSellerClientId: string | null;
    ozonSellerHasToken: boolean;
    ozonPerfClientId: string | null;
    ozonPerfHasSecret: boolean;
  };
}

export default function MarketplaceIntegrationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [integration, setIntegration] = useState<MarketplaceIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE" | "ERROR",
    ozonSellerClientId: "",
    ozonSellerToken: "",
    ozonPerfClientId: "",
    ozonPerfClientSecret: "",
  });

  const [tokenChanged, setTokenChanged] = useState(false);
  const [secretChanged, setSecretChanged] = useState(false);
  const [showSellerToken, setShowSellerToken] = useState(false);
  const [showPerfSecret, setShowPerfSecret] = useState(false);
  const [hasSavedToken, setHasSavedToken] = useState(false);
  const [hasSavedSecret, setHasSavedSecret] = useState(false);

  useEffect(() => {
    if (id) {
      loadIntegration();
    }
  }, [id]);

  const loadIntegration = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<MarketplaceIntegration>(
        `/settings/marketplace-integrations/${id}`
      );
      setIntegration(data);
      setFormData({
        name: data.name,
        status: data.status,
        ozonSellerClientId: data.credentials.ozonSellerClientId || "",
        ozonSellerToken: "",
        ozonPerfClientId: data.credentials.ozonPerfClientId || "",
        ozonPerfClientSecret: "",
      });
      setTokenChanged(false);
      setSecretChanged(false);
      setHasSavedToken(data.credentials.ozonSellerHasToken);
      setHasSavedSecret(data.credentials.ozonPerfHasSecret);
      // Reset visibility when loading - tokens are hidden by default after save
      setShowSellerToken(false);
      setShowPerfSecret(false);
    } catch (error) {
      console.error("Failed to load integration:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!integration) return;

    try {
      setSaving(true);
      const payload: any = {
        name: formData.name,
        status: formData.status,
        ozonSellerClientId: formData.ozonSellerClientId,
        ozonPerfClientId: formData.ozonPerfClientId,
      };

      // Only send token/secret if they were changed
      if (tokenChanged && formData.ozonSellerToken !== undefined) {
        payload.ozonSellerToken = formData.ozonSellerToken || null;
      }

      if (secretChanged && formData.ozonPerfClientSecret !== undefined) {
        payload.ozonPerfClientSecret = formData.ozonPerfClientSecret || null;
      }

      await apiRequest(`/settings/marketplace-integrations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      alert(t("settings.marketplaceIntegrations.messages.updated"));
      await loadIntegration();
      // After saving, tokens should be hidden by default
      setShowSellerToken(false);
      setShowPerfSecret(false);
    } catch (error: any) {
      console.error("Failed to save integration:", error);
      alert(error.message || t("settings.marketplaceIntegrations.messages.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!integration) return;

    try {
      setTesting(true);
      // Send credentials from form data for testing (even if not saved yet)
      const payload: any = {
        ozonSellerClientId: formData.ozonSellerClientId || undefined,
        ozonPerfClientId: formData.ozonPerfClientId || undefined,
      };

      // Include token/secret if they were entered (even if not saved)
      if (formData.ozonSellerToken) {
        payload.ozonSellerToken = formData.ozonSellerToken;
      }

      if (formData.ozonPerfClientSecret) {
        payload.ozonPerfClientSecret = formData.ozonPerfClientSecret;
      }

      const result = await apiRequest<{ ok: boolean; status: string; message: string }>(
        `/settings/marketplace-integrations/${id}/test-connection`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      if (result.ok) {
        alert(
          result.message || t("settings.marketplaceIntegrations.messages.testSuccess")
        );
      } else {
        alert(
          `${t("settings.marketplaceIntegrations.messages.testError")}: ${result.message}`
        );
      }
      await loadIntegration();
    } catch (error: any) {
      console.error("Failed to test connection:", error);
      alert(error.message || t("settings.marketplaceIntegrations.messages.testError"));
    } finally {
      setTesting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-green-600">ACTIVE</Badge>;
      case "INACTIVE":
        return <Badge variant="secondary">INACTIVE</Badge>;
      case "ERROR":
        return <Badge variant="destructive">ERROR</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-8">{t("common.actions.loading")}</div>
      </MainLayout>
    );
  }

  if (!integration) {
    return (
      <MainLayout>
        <div className="text-center py-8">{t("common.messages.notFound")}</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{integration.name}</h1>
          <p className="text-muted-foreground mt-2">
            {t("settings.marketplaceIntegrations.detail.title")}
          </p>
        </div>

        {/* Information Section */}
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.marketplaceIntegrations.detail.sections.info")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("settings.marketplaceIntegrations.detail.fields.marketplace")}</Label>
                <p className="text-sm font-medium">{integration.marketplace.name}</p>
              </div>
              <div>
                <Label>{t("settings.marketplaceIntegrations.detail.fields.brand")}</Label>
                <p className="text-sm font-medium">{integration.brand.name}</p>
              </div>
              <div>
                <Label>{t("settings.marketplaceIntegrations.detail.fields.country")}</Label>
                <p className="text-sm font-medium">{integration.country.name}</p>
              </div>
              <div>
                <Label>{t("settings.marketplaceIntegrations.detail.fields.status")}</Label>
                <div className="mt-1">{getStatusBadge(integration.status)}</div>
              </div>
              <div>
                <Label>{t("settings.marketplaceIntegrations.detail.fields.lastSync")}</Label>
                <p className="text-sm">{formatDate(integration.lastSyncAt)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">
                {t("settings.marketplaceIntegrations.detail.fields.name")}
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">
                {t("settings.marketplaceIntegrations.detail.fields.status")}
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value: "ACTIVE" | "INACTIVE" | "ERROR") =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                  <SelectItem value="ERROR">ERROR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Ozon Seller API Section */}
        <Card>
          <CardHeader>
            <CardTitle>
              {t("settings.marketplaceIntegrations.detail.sections.ozonSeller")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ozonSellerClientId">
                {t("settings.marketplaceIntegrations.detail.fields.clientId")}
              </Label>
              <Input
                id="ozonSellerClientId"
                value={formData.ozonSellerClientId}
                onChange={(e) =>
                  setFormData({ ...formData, ozonSellerClientId: e.target.value })
                }
                placeholder="Enter Client ID"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ozonSellerToken">
                {t("settings.marketplaceIntegrations.detail.fields.token")}
              </Label>
              {hasSavedToken && !tokenChanged && (
                <p className="text-sm text-muted-foreground mb-1">
                  {t("settings.marketplaceIntegrations.detail.fields.tokenSet")}
                </p>
              )}
              <div className="relative">
                <Input
                  id="ozonSellerToken"
                  type={
                    hasSavedToken
                      ? showSellerToken
                        ? "text"
                        : "password"
                      : "text"
                  }
                  value={formData.ozonSellerToken}
                  onChange={(e) => {
                    setFormData({ ...formData, ozonSellerToken: e.target.value });
                    setTokenChanged(true);
                  }}
                  placeholder={
                    hasSavedToken && !tokenChanged ? "********" : "Enter Token"
                  }
                  className={hasSavedToken ? "pr-10" : ""}
                />
                {hasSavedToken && (
                  <button
                    type="button"
                    onClick={() => setShowSellerToken((prev) => !prev)}
                    className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showSellerToken ? "Hide token" : "Show token"}
                  >
                    {showSellerToken ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ozon Performance API Section */}
        <Card>
          <CardHeader>
            <CardTitle>
              {t("settings.marketplaceIntegrations.detail.sections.ozonPerformance")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ozonPerfClientId">
                {t("settings.marketplaceIntegrations.detail.fields.clientId")}
              </Label>
              <Input
                id="ozonPerfClientId"
                value={formData.ozonPerfClientId}
                onChange={(e) =>
                  setFormData({ ...formData, ozonPerfClientId: e.target.value })
                }
                placeholder="Enter Client ID"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ozonPerfClientSecret">
                {t("settings.marketplaceIntegrations.detail.fields.clientSecret")}
              </Label>
              {hasSavedSecret && !secretChanged && (
                <p className="text-sm text-muted-foreground mb-1">
                  {t("settings.marketplaceIntegrations.detail.fields.secretSet")}
                </p>
              )}
              <div className="relative">
                <Input
                  id="ozonPerfClientSecret"
                  type={
                    hasSavedSecret
                      ? showPerfSecret
                        ? "text"
                        : "password"
                      : "text"
                  }
                  value={formData.ozonPerfClientSecret}
                  onChange={(e) => {
                    setFormData({ ...formData, ozonPerfClientSecret: e.target.value });
                    setSecretChanged(true);
                  }}
                  placeholder={
                    hasSavedSecret && !secretChanged
                      ? "********"
                      : "Enter Client Secret"
                  }
                  className={hasSavedSecret ? "pr-10" : ""}
                />
                {hasSavedSecret && (
                  <button
                    type="button"
                    onClick={() => setShowPerfSecret((prev) => !prev)}
                    className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPerfSecret ? "Hide secret" : "Show secret"}
                  >
                    {showPerfSecret ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? t("common.actions.loading")
              : t("settings.marketplaceIntegrations.detail.actions.save")}
          </Button>
          <Button onClick={handleTestConnection} variant="outline" disabled={testing}>
            {testing
              ? t("common.actions.loading")
              : t("settings.marketplaceIntegrations.detail.actions.testConnection")}
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            {t("common.actions.back")}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}


