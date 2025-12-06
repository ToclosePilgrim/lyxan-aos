"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";

interface Role {
  id: string;
  name: string;
  usersCount: number;
}

export default function SettingsRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<Role[]>(`/settings/roles`);
      setRoles(data || []);
    } catch (error) {
      console.error("Failed to load roles:", error);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (roleName: string) => {
    switch (roleName) {
      case "Admin":
        return <Badge variant="default">Admin</Badge>;
      case "Manager":
        return <Badge variant="secondary">Manager</Badge>;
      default:
        return <Badge>{roleName}</Badge>;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roles</h1>
          <p className="text-muted-foreground mt-2">
            Роли и права доступа в системе
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Роли</CardTitle>
            <CardDescription>
              {roles.length} роль(ей)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Загрузка...</div>
            ) : roles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Роли не найдены
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Users Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">
                        {getRoleBadge(role.name)}
                      </TableCell>
                      <TableCell>{role.usersCount}</TableCell>
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

