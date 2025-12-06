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
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";

interface User {
  id: string;
  email: string;
  role: {
    id: string;
    name: string;
  };
  createdAt: string;
}

interface Role {
  id: string;
  name: string;
}

export default function SettingsUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<User[]>(`/settings/users`);
      setUsers(data || []);
    } catch (error) {
      console.error("Failed to load users:", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const data = await apiRequest<Role[]>(`/settings/roles`);
      setRoles(data || []);
    } catch (error) {
      console.error("Failed to load roles:", error);
      setRoles([]);
    }
  };

  const handleRoleChange = async (userId: string, newRoleId: string) => {
    try {
      setUpdatingUserId(userId);
      await apiRequest(`/settings/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ roleId: newRoleId }),
      });
      loadUsers();
      alert("Роль пользователя обновлена");
    } catch (error: any) {
      console.error("Failed to update user role:", error);
      alert(error.message || "Ошибка при обновлении роли");
    } finally {
      setUpdatingUserId(null);
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
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground mt-2">
            Manage system users
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>
              {users.length} пользователь(ей)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Загрузка...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Пользователи не найдены
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>CreatedAt</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{getRoleBadge(user.role.name)}</TableCell>
                      <TableCell>
                        {new Date(user.createdAt).toLocaleDateString("ru-RU")}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.role.id}
                          onValueChange={(value) =>
                            handleRoleChange(user.id, value)
                          }
                          disabled={updatingUserId === user.id}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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

