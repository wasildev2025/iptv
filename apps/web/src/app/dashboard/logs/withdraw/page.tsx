"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { CreditTransaction, PaginatedResponse } from "@/types";
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
  Coins, ChevronLeft, ChevronRight, ArrowUpDown, Search,
} from "lucide-react";

export default function WithdrawLogsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortKey, setSortKey] = useState<"amount" | "createdAt">("createdAt");
  const [sortType, setSortType] = useState<"asc" | "desc">("desc");

  const { data, isLoading } = useQuery<PaginatedResponse<CreditTransaction>>({
    queryKey: ["withdraw-logs", page, pageSize, keyword, sortKey, sortType],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        type: "transfer_out",
      });
      if (keyword) params.set("keyword", keyword);
      if (sortKey) params.set("sortKey", sortKey);
      if (sortType) params.set("sortType", sortType);
      return (await api.get(`/logs/credits?${params}`)).data;
    },
  });

  const handleSearch = () => {
    setKeyword(searchInput);
    setPage(1);
  };

  const toggleSort = (key: "amount" | "createdAt") => {
    if (sortKey === key) {
      setSortType(sortType === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortType("desc");
    }
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Withdraw Point Share Logs</h2>
        <p className="text-muted-foreground">
          View logs of credits transferred out from your account
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Withdraw Logs</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
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
              <Coins className="mb-3 h-10 w-10 opacity-40" />
              <p>No withdraw logs found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>
                      <button
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => toggleSort("amount")}
                      >
                        Credit Point
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>Sent To</TableHead>
                    <TableHead>Withdrawn By</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>
                      <button
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => toggleSort("createdAt")}
                      >
                        Created At
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <Badge variant="destructive">Withdraw</Badge>
                      </TableCell>
                      <TableCell className="font-mono font-medium text-red-600">
                        -{Math.abs(Number(tx.amount))}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(tx as any).sentTo || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(tx as any).withdrawnBy || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(tx as any).createdBy || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(tx.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

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
