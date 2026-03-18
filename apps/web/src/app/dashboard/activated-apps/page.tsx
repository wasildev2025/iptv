"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Device, App, PaginatedResponse } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Search,
  Monitor,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";

const STATUS_COLORS: Record<string, "success" | "destructive" | "warning" | "secondary"> = {
  active: "success",
  expired: "destructive",
  disabled: "warning",
  trial: "secondary",
};

export default function ActivatedAppsPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchField, setSearchField] = useState("general");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: devicesData, isLoading } = useQuery<PaginatedResponse<Device>>({
    queryKey: ["activated-apps", page, limit, search, searchField, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) {
        params.set("search", search);
        params.set("searchField", searchField);
      }
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      return (await api.get(`/devices?${params}`)).data;
    },
  });

  const { data: apps } = useQuery<App[]>({
    queryKey: ["apps"],
    queryFn: async () => (await api.get("/apps")).data,
  });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleReset = () => {
    setSearchInput("");
    setSearch("");
    setSearchField("general");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Activated Apps</h2>
        <p className="text-muted-foreground">View all activated app subscriptions</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="bg-red-600 text-white rounded-t-lg py-3 px-4">
          <CardTitle className="text-base font-medium">Search Filters</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-[160px]">
              <Label className="mb-1.5 block text-xs text-muted-foreground">Search By</Label>
              <Select
                value={searchField}
                onChange={(e) => setSearchField(e.target.value)}
              >
                <option value="general">General Search</option>
                <option value="macAddress">MAC Address</option>
                <option value="appName">App Name</option>
                <option value="remarks">Remarks</option>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label className="mb-1.5 block text-xs text-muted-foreground">Search</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter search term..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
            </div>
            <div className="w-[170px]">
              <Label className="mb-1.5 block text-xs text-muted-foreground">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="w-[170px]">
              <Label className="mb-1.5 block text-xs text-muted-foreground">End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleSearch}>
                <Search className="mr-2 h-4 w-4" /> Search
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="bg-red-600 text-white rounded-t-lg py-3 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium">Activated Apps List</CardTitle>
          <div className="flex items-center gap-2 text-sm">
            <span>Show</span>
            <select
              className="rounded border border-white/30 bg-red-700 text-white px-2 py-1 text-sm"
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>entries</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !devicesData?.data?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Monitor className="mb-4 h-12 w-12 opacity-40" />
              <p className="text-lg font-medium">No activated apps found</p>
              <p className="text-sm">Try adjusting your search filters</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>App Name</TableHead>
                      <TableHead>Mac Address</TableHead>
                      <TableHead>Activated By</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Used Credit</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Activated On</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devicesData.data.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell>
                          <span className="font-medium">{device.app?.name || "---"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">{device.macAddress}</span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {(device as any).activatedBy || "---"}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1">
                            <Badge variant={STATUS_COLORS[device.status] || "secondary"} className="text-xs">
                              {device.status}
                            </Badge>
                            <span>{device.expiresAt ? formatDate(device.expiresAt) : "Lifetime"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {(device as any).creditUsed ?? ((device.packageType === "yearly" ? device.app?.creditsYearly : device.app?.creditsLifetime) || "---")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                          {device.notes || "---"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {(device as any).platform || device.packageType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(device.activatedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {devicesData.totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * limit + 1}--
                    {Math.min(page * limit, devicesData.total)} of {devicesData.total}
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
                    <span className="text-sm font-medium">
                      {page} / {devicesData.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= devicesData.totalPages}
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
