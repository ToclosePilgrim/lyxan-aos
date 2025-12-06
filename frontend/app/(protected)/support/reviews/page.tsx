"use client";

import { useState, useEffect } from "react";
import { MainLayout } from "@/components/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";
import Link from "next/link";

interface Review {
  id: string;
  date: string;
  rating: number;
  text: string | null;
  sku: {
    id: string;
    code: string;
    product: {
      id: string;
      name: string;
      brand: {
        name: string;
      };
    };
  } | null;
}

export default function SupportReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [openDialog, setOpenDialog] = useState(false);

  const [filters, setFilters] = useState({
    rating: "",
    minRating: "",
    skuId: "",
    dateFrom: "",
    dateTo: "",
  });

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.rating) params.append("rating", filters.rating);
      if (filters.minRating) params.append("minRating", filters.minRating);
      if (filters.skuId) params.append("skuId", filters.skuId);
      if (filters.dateFrom) params.append("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.append("dateTo", filters.dateTo);

      const query = params.toString();
      const endpoint = `/support/reviews${query ? `?${query}` : ""}`;
      const data = await apiRequest<Review[]>(endpoint);
      setReviews(data || []);
    } catch (error) {
      console.error("Failed to load reviews:", error);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    loadReviews();
  };

  const renderRating = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        <Badge variant="outline" className="font-medium">
          {rating} ⭐
        </Badge>
      </div>
    );
  };

  const truncateText = (text: string | null, maxLength: number = 50) => {
    if (!text) return "-";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reviews</h1>
          <p className="text-muted-foreground mt-2">
            Product reviews
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Фильтры</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rating">Rating</Label>
                <Select
                  value={filters.rating}
                  onValueChange={(value) =>
                    setFilters({ ...filters, rating: value, minRating: "" })
                  }
                >
                  <SelectTrigger id="rating">
                    <SelectValue placeholder="Все" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Все</SelectItem>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="minRating">Min Rating</Label>
                <Select
                  value={filters.minRating}
                  onValueChange={(value) =>
                    setFilters({ ...filters, minRating: value, rating: "" })
                  }
                >
                  <SelectTrigger id="minRating">
                    <SelectValue placeholder="Любой" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Любой</SelectItem>
                    <SelectItem value="1">1+</SelectItem>
                    <SelectItem value="2">2+</SelectItem>
                    <SelectItem value="3">3+</SelectItem>
                    <SelectItem value="4">4+</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="skuId">SKU Code</Label>
                <Input
                  id="skuId"
                  value={filters.skuId}
                  onChange={(e) =>
                    setFilters({ ...filters, skuId: e.target.value })
                  }
                  placeholder="SKU code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateFrom">Дата от</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) =>
                    setFilters({ ...filters, dateFrom: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateTo">Дата до</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) =>
                    setFilters({ ...filters, dateTo: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={handleApplyFilters}>Применить</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Отзывы</CardTitle>
            <CardDescription>
              {reviews.length} отзыв(ов)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Загрузка...</div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Отзывы не найдены
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Text</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviews.map((review) => (
                    <TableRow key={review.id}>
                      <TableCell>
                        {new Date(review.date).toLocaleDateString("ru-RU")}
                      </TableCell>
                      <TableCell>
                        {review.sku ? (
                          <Link
                            href={`/scm/products/${review.sku.product.id}`}
                            className="text-primary hover:underline"
                          >
                            {review.sku.code}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{renderRating(review.rating)}</TableCell>
                      <TableCell>
                        {review.text ? (
                          <div>
                            <span>{truncateText(review.text)}</span>
                            {review.text.length > 50 && (
                              <Button
                                variant="link"
                                className="p-0 h-auto ml-2"
                                onClick={() => {
                                  setSelectedReview(review);
                                  setOpenDialog(true);
                                }}
                              >
                                Читать далее
                              </Button>
                            )}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Отзыв</DialogTitle>
            </DialogHeader>
            {selectedReview && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Дата</p>
                  <p>
                    {new Date(selectedReview.date).toLocaleString("ru-RU")}
                  </p>
                </div>
                {selectedReview.sku && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">SKU</p>
                    <p>{selectedReview.sku.code}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Рейтинг</p>
                  <div>{renderRating(selectedReview.rating)}</div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Текст</p>
                  <p className="whitespace-pre-wrap">{selectedReview.text || "-"}</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

