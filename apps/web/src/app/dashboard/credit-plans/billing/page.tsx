"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { PaginatedResponse } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Receipt, ChevronLeft, ChevronRight, Search,
} from "lucide-react";

interface BillingRecord {
  id: string;
  resellerName: string;
  resellerEmail: string;
  planTitle: string;
  amountUsd: number;
  credits: number;
  status: "pending" | "completed" | "failed" | "refunded";
  transactionId: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: "success" | "destructive" | "warning" | "secondary" | "default" }> = {
  pending: { label: "Pending", color: "warning" },
  completed: { label: "Completed", color: "success" },
  failed: { label: "Failed", color: "destructive" },
  refunded: { label: "Refunded", color: "secondary" },
};

export default function BillingPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading } = useQuery<PaginatedResponse<BillingRecord>>({
    queryKey: ["billing-history", page, pageSize, keyword],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (keyword) params.set("keyword", keyword);
      return (await api.get(`/payments/history?${params}`)).data;
    },
  });

  const handleSearch = () => {
    setKeyword(searchInput);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Billing</h2>
        <p className="text-muted-foreground">
          View your payment history and billing records
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Payment History</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  className="pl-8 w-[250px]"
                  value={searchInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchInput(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleSearch}>
                Search
              </Button>
              <Select
                className="w-[100px]"
                value={String(pageSize)}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value="10">Show 10</option>
                <option value="25">Show 25</option>
                <option value="50">Show 50</option>
                <option value="100">Show 100</option>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !data?.data?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Receipt className="mb-3 h-10 w-10 opacity-40" />
              <p>No billing records found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Reseller Name</TableHead>
                      <TableHead>Reseller Email</TableHead>
                      <TableHead>Plan Title</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Credit Points</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>Created At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((record) => {
                      const statusConfig = STATUS_CONFIG[record.status] || {
                        label: record.status,
                        color: "secondary" as const,
                      };
                      return (
                        <TableRow key={record.id}>
                          <TableCell className="font-mono text-sm">
                            {record.id.slice(0, 8)}...
                          </TableCell>
                          <TableCell className="text-sm">
                            {record.resellerName || "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {record.resellerEmail || "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {record.planTitle || "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            &euro;{Number(record.amountUsd || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-green-600">
                            {record.credits || 0}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusConfig.color}>
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground max-w-[120px] truncate">
                            {record.transactionId || "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(record.createdAt)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {data.totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {data.totalPages} ({data.total} total)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= data.totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
