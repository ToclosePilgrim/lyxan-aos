import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings Module</h1>
          <p className="text-muted-foreground mt-2">
            Настройки - конфигурация системы
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Settings Module Placeholder</CardTitle>
            <CardDescription>
              Этот модуль находится в разработке
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Здесь будет функциональность для настройки системы, управления пользователями и конфигурацией.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

