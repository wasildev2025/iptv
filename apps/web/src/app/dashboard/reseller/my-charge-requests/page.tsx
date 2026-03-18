"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Search, ChevronLeft, ChevronRight, Receipt,
} from "lucide-react";

function statusBadge(status: string) {
  switch (status) {
    case "pending":
      return <Badge variant="warning">Pending</Badge>;
    case "approved":
      return <Badge variant="success">Approved</Badge>;
    case "rejected":
      return <Badge variant="destructive">Rejected</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function typeBadge(type: string) {
  if (type === "sent") {
    return <Badge variant="secondary">Sent</Badge>;
  }
  return <Badge className="bg-blue-100 text-blue-800">Received</Badge>;
}

export default function MyChargeRequestsPage() {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["my-charge-requests", page, perPage, search, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      if (search) params.set("search", search);
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      return (await api.get(`/recharge-requests/my?${params}`)).data;
    },
  });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const requests = data?.data || [];
  const totalPages = data?.totalPages || data?.total_pages || 1;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">My Charge Requests</h2>
        <p className="text-muted-foreground">
          View all your sent and received recharge requests
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-[160px]">
              <Label className="mb-1.5 block text-xs text-muted-foreground">
                Start Date
              </Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="w-[160px]">
              <Label className="mb-1.5 block text-xs text-muted-foreground">
                End Date
              </Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label className="mb-1.5 block text-xs text-muted-foreground">
                Search
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Search by name or email..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button variant="outline" size="icon" onClick={handleSearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="w-[100px]">
              <Label className="mb-1.5 block text-xs text-muted-foreground">
                Show
              </Label>
              <Select
                value={String(perPage)}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !requests.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Receipt className="mb-4 h-12 w-12 opacity-40" />
              <p className="text-lg font-medium">No charge requests</p>
              <p className="text-sm">Your sent and received requests will appear here</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>From / To</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Request Date</TableHead>
                    <TableHead>Approval Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req: any) => (
                    <TableRow key={req.id}>
                      <TableCell>
                        {typeBadge(req.type || req.direction || "sent")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {req.from_to || req.counterparty_name || req.counterparty?.name || req.from || req.to || "-"}
                        {(req.counterparty_email || req.counterparty?.email) && (
                          <span className="block text-xs text-muted-foreground">
                            {req.counterparty_email || req.counterparty?.email}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {req.requested_amount || req.requestedAmount || req.amount}
                      </TableCell>
                      <TableCell>{statusBadge(req.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(req.created_at || req.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {req.approved_at || req.approvedAt || req.resolved_at || req.resolvedAt
                          ? formatDate(req.approved_at || req.approvedAt || req.resolved_at || req.resolvedAt)
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
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
                      disabled={page >= totalPages}
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
