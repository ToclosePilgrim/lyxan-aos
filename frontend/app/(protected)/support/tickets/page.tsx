"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";
import Link from "next/link";

interface SupportTicket {
  id: string;
  text: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    text: "",
  });

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<SupportTicket[]>(`/support/tickets`);
      setTickets(data || []);
    } catch (error) {
      console.error("Failed to load tickets:", error);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    try {
      setSaving(true);
      await apiRequest(`/support/tickets`, {
        method: "POST",
        body: JSON.stringify(formData),
      });

      setFormData({
        title: "",
        text: "",
      });
      setOpenDialog(false);
      loadTickets();
      alert("Тикет создан");
    } catch (error: any) {
      console.error("Failed to create ticket:", error);
      alert(error.message || "Ошибка при создании тикета");
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "NEW":
        return <Badge variant="default">NEW</Badge>;
      case "IN_PROGRESS":
        return <Badge variant="secondary">IN_PROGRESS</Badge>;
      case "RESOLVED":
        return <Badge className="bg-green-600">RESOLVED</Badge>;
      case "CLOSED":
        return <Badge variant="outline">CLOSED</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const extractTitle = (text: string): string => {
    const lines = text.split('\n');
    return lines[0] || text.substring(0, 100);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Support Tickets</h1>
            <p className="text-muted-foreground mt-2">
              Обращения и тикеты поддержки
            </p>
          </div>
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button>Создать тикет</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Создать тикет</DialogTitle>
                <DialogDescription>
                  Создайте новое обращение в поддержку
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Заголовок</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="Краткое описание проблемы"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="text">Описание</Label>
                  <Textarea
                    id="text"
                    value={formData.text}
                    onChange={(e) =>
                      setFormData({ ...formData, text: e.target.value })
                    }
                    placeholder="Подробное описание проблемы"
                    rows={6}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpenDialog(false)}
                  disabled={saving}
                >
                  Отмена
                </Button>
                <Button onClick={handleCreateTicket} disabled={saving}>
                  {saving ? "Создание..." : "Создать"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Тикеты</CardTitle>
            <CardDescription>
              {tickets.length} тикет(ов)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Загрузка...</div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Тикеты не найдены
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>CreatedAt</TableHead>
                    <TableHead>UpdatedAt</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-mono text-sm">
                        {ticket.id.substring(0, 8)}...
                      </TableCell>
                      <TableCell className="font-medium">
                        {extractTitle(ticket.text)}
                      </TableCell>
                      <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                      <TableCell>
                        {new Date(ticket.createdAt).toLocaleDateString("ru-RU")}
                      </TableCell>
                      <TableCell>
                        {new Date(ticket.updatedAt).toLocaleDateString("ru-RU")}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/support/tickets/${ticket.id}`}>
                            Открыть
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

