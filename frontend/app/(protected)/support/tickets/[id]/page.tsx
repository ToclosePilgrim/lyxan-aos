"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/api";
import Link from "next/link";

interface SupportTicket {
  id: string;
  title: string;
  body: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function SupportTicketDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ticketId) {
      loadTicket();
    }
  }, [ticketId]);

  const loadTicket = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<SupportTicket>(
        `/support/tickets/${ticketId}`
      );
      setTicket(data);
    } catch (error) {
      console.error("Failed to load ticket:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      setSaving(true);
      await apiRequest(`/support/tickets/${ticketId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      loadTicket();
      alert("Статус обновлён");
    } catch (error: any) {
      console.error("Failed to update status:", error);
      alert(error.message || "Ошибка при обновлении статуса");
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

  if (loading) {
    return (
      <MainLayout>
        <div className="text-center py-8">Загрузка...</div>
      </MainLayout>
    );
  }

  if (!ticket) {
    return (
      <MainLayout>
        <div className="text-center py-8 text-muted-foreground">
          Тикет не найден
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="outline" asChild>
              <Link href="/support/tickets">← Назад к списку</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{ticket.title}</CardTitle>
                <CardDescription>
                  ID: {ticket.id.substring(0, 8)}...
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(ticket.status)}
                <Select
                  value={ticket.status}
                  onValueChange={handleUpdateStatus}
                  disabled={saving}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">NEW</SelectItem>
                    <SelectItem value="IN_PROGRESS">IN_PROGRESS</SelectItem>
                    <SelectItem value="RESOLVED">RESOLVED</SelectItem>
                    <SelectItem value="CLOSED">CLOSED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Описание
                </p>
                <p className="whitespace-pre-wrap mt-1">{ticket.body}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Создан
                  </p>
                  <p>
                    {new Date(ticket.createdAt).toLocaleString("ru-RU")}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Обновлён
                  </p>
                  <p>
                    {new Date(ticket.updatedAt).toLocaleString("ru-RU")}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

