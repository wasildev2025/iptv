"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MacInput } from "@/components/ui/mac-input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Search, ChevronLeft, ChevronRight, Plus, Tv, Key,
} from "lucide-react";

function statusBadge(status: string) {
  switch (status) {
    case "available":
    case "active":
      return <Badge variant="success">{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
    case "used":
      return <Badge variant="secondary">Used</Badge>;
    case "expired":
      return <Badge variant="destructive">Expired</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function IboProTvPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [creditCount, setCreditCount] = useState("1");
  const [numberOfCodes, setNumberOfCodes] = useState("1");

  // Activate dialog state
  const [activateOpen, setActivateOpen] = useState(false);
  const [activateCreditCount, setActivateCreditCount] = useState("1");
  const [macAddress, setMacAddress] = useState("");

  // Fetch activation codes
  const { data, isLoading } = useQuery({
    queryKey: ["activation-codes", page, perPage, search, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      if (search) params.set("search", search);
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      return (await api.get(`/activation-codes?${params}`)).data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      api.post("/activation-codes/generate", {
        credit_count: Number(creditCount),
        number_of_codes: Number(numberOfCodes),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activation-codes"] });
      setCreateOpen(false);
      setCreditCount("1");
      setNumberOfCodes("1");
      toast.success("Activation codes generated successfully");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || "Failed to generate codes"),
  });

  const activateMutation = useMutation({
    mutationFn: () =>
      api.post("/activation-codes/activate", {
        credit_count: Number(activateCreditCount),
        mac_address: macAddress,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activation-codes"] });
      setActivateOpen(false);
      setActivateCreditCount("1");
      setMacAddress("");
      toast.success("Code activated for device successfully");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || "Failed to activate code"),
  });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const codes = data?.data || [];
  const totalPages = data?.totalPages || data?.total_pages || 1;

  const creditLabel = (count: string) =>
    count === "1" ? "1 Credit (1 Year)" : "2 Credits (Lifetime)";

  const costPerCode = creditCount === "1" ? 1 : 2;
  const totalCost = costPerCode * Number(numberOfCodes || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">IboProTv</h2>
          <p className="text-muted-foreground">
            Manage activation codes for IboProTv devices
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="bg-red-600 hover:bg-red-700"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" /> Create New Code
          </Button>
          <Button variant="outline" onClick={() => setActivateOpen(true)}>
            <Tv className="mr-2 h-4 w-4" /> Activate Code for Device
          </Button>
        </div>
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
                  placeholder="Search by code or MAC address..."
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
          ) : !codes.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Key className="mb-4 h-12 w-12 opacity-40" />
              <p className="text-lg font-medium">No activation codes</p>
              <p className="text-sm">Generate your first activation code to get started</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Linked By (MAC)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {codes.map((code: any) => (
                    <TableRow key={code.id}>
                      <TableCell className="font-mono text-sm font-medium">
                        {code.code}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {code.credit_count === 2 || code.creditCount === 2 || code.type === "lifetime"
                            ? "Lifetime"
                            : "1 Year"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {code.mac_address || code.macAddress || "-"}
                      </TableCell>
                      <TableCell>
                        {statusBadge(code.status)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(code.created_at || code.createdAt)}
                      </TableCell>
                      <TableCell>
                        {(code.status === "available" || code.status === "active") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(code.code);
                              toast.success("Code copied to clipboard");
                            }}
                          >
                            Copy
                          </Button>
                        )}
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

      {/* Create New Code Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent onClose={() => setCreateOpen(false)}>
          <DialogHeader>
            <DialogTitle>Create New Activation Code</DialogTitle>
            <DialogDescription>
              Generate activation codes for IboProTv devices
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              generateMutation.mutate();
            }}
            className="mt-4 space-y-4"
          >
            <div className="space-y-1.5">
              <Label>Credit Count *</Label>
              <Select
                value={creditCount}
                onChange={(e) => setCreditCount(e.target.value)}
              >
                <option value="1">1 Credit - 1 Year</option>
                <option value="2">2 Credits - Lifetime</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Number of Codes *</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={numberOfCodes}
                onChange={(e) => setNumberOfCodes(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Maximum 10 codes per request</p>
            </div>
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-sm font-medium">Cost Summary</p>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span>{creditLabel(creditCount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Codes:</span>
                  <span>{numberOfCodes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cost per code:</span>
                  <span>{costPerCode} credit(s)</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-medium">
                  <span>Total Cost:</span>
                  <span className="text-red-600">{totalCost} credit(s)</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-red-600 hover:bg-red-700"
                isLoading={generateMutation.isPending}
              >
                Generate Codes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Activate Code for Device Dialog */}
      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent onClose={() => setActivateOpen(false)}>
          <DialogHeader>
            <DialogTitle>Activate Code for Device</DialogTitle>
            <DialogDescription>
              Link an activation code to a device MAC address
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!macAddress.trim()) {
                toast.error("Please enter a MAC address");
                return;
              }
              activateMutation.mutate();
            }}
            className="mt-4 space-y-4"
          >
            <div className="space-y-1.5">
              <Label>Credit Count *</Label>
              <Select
                value={activateCreditCount}
                onChange={(e) => setActivateCreditCount(e.target.value)}
              >
                <option value="1">1 Credit - 1 Year</option>
                <option value="2">2 Credits - Lifetime</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>MAC Address *</Label>
              <MacInput
                value={macAddress}
                onChange={setMacAddress}
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setActivateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-red-600 hover:bg-red-700"
                isLoading={activateMutation.isPending}
              >
                Activate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
