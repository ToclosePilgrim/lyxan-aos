import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { t } from "@/lib/i18n";

export default function SettingsPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("settings.title")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("settings.subtitle")}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.countries.title")}</CardTitle>
              <CardDescription>{t("settings.countries.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/settings/countries">
                <Button variant="outline" className="w-full">
                  {t("common.actions.edit")}
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("settings.marketplaces.title")}</CardTitle>
              <CardDescription>{t("settings.marketplaces.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/settings/marketplaces">
                <Button variant="outline" className="w-full">
                  {t("common.actions.edit")}
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("settings.marketplaceAvailability.title")}</CardTitle>
              <CardDescription>
                {t("settings.marketplaceAvailability.subtitle")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/settings/marketplace-availability">
                <Button variant="outline" className="w-full">
                  {t("common.actions.edit")}
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("settings.users.title")}</CardTitle>
              <CardDescription>{t("settings.users.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/settings/users">
                <Button variant="outline" className="w-full">
                  {t("common.actions.edit")}
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("settings.roles.title")}</CardTitle>
              <CardDescription>{t("settings.roles.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/settings/roles">
                <Button variant="outline" className="w-full">
                  {t("common.actions.edit")}
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("settings.marketplaceIntegrations.title")}</CardTitle>
              <CardDescription>{t("settings.marketplaceIntegrations.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/settings/marketplace-integrations">
                <Button variant="outline" className="w-full">
                  {t("common.actions.edit")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}

