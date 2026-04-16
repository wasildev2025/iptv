"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Device, App, PaginatedResponse } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MacInput } from "@/components/ui/mac-input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreHorizontal,
  RefreshCw,
  Power,
  PowerOff,
  Trash2,
  Monitor,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const STATUS_COLORS: Record<string, "success" | "destructive" | "warning" | "secondary"> = {
  active: "success",
  expired: "destructive",
  disabled: "warning",
  trial: "secondary",
};

const addDeviceSchema = z.object({
  appId: z.string().min(1, "Select an app"),
  macAddress: z
    .string()
    .regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, "Invalid MAC address (XX:XX:XX:XX:XX:XX)"),
  macAddressAlt: z
    .string()
    .regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, "Invalid MAC format")
    .optional()
    .or(z.literal("")),
  packageType: z.enum(["yearly", "lifetime"]),
  notes: z.string().max(500).optional(),
  playlistUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
});

type AddDeviceForm = z.infer<typeof addDeviceSchema>;

export default function DevicesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [appFilter, setAppFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  // Fetch devices
  const { data: devicesData, isLoading } = useQuery<PaginatedResponse<Device>>({
    queryKey: ["devices", page, search, statusFilter, appFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (appFilter) params.set("appId", appFilter);
      return (await api.get(`/devices?${params}`)).data;
    },
  });

  // Fetch apps for filter/add form
  const { data: apps } = useQuery<App[]>({
    queryKey: ["apps"],
    queryFn: async () => (await api.get("/apps")).data,
  });

  // Add device form
  const form = useForm<AddDeviceForm>({
    resolver: zodResolver(addDeviceSchema),
    defaultValues: { packageType: "yearly", notes: "", playlistUrl: "", macAddressAlt: "" },
  });

  const addMutation = useMutation({
    mutationFn: (data: AddDeviceForm) => api.post("/devices", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setAddOpen(false);
      form.reset();
      toast.success("Device activated successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to add device");
    },
  });

  const renewMutation = useMutation({
    mutationFn: (id: string) => api.post(`/devices/${id}/renew`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Device renewed");
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Renewal failed"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "enable" | "disable" }) =>
      api.post(`/devices/${id}/${action}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Device status updated");
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/devices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Device deleted");
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Delete failed"),
  });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const selectedApp = apps?.find((a) => a.id === form.watch("appId"));
  const selectedPkg = form.watch("packageType");
  const creditCost = selectedApp
    ? selectedPkg === "yearly"
      ? selectedApp.creditsYearly
      : selectedApp.creditsLifetime
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Devices</h2>
          <p className="text-muted-foreground">Manage your IPTV device activations</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Device
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label className="mb-1.5 block text-xs text-muted-foreground">Search</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Search MAC, notes..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button variant="outline" size="icon" onClick={handleSearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="w-[160px]">
              <Label className="mb-1.5 block text-xs text-muted-foreground">Status</Label>
              <Select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="disabled">Disabled</option>
                <option value="trial">Trial</option>
              </Select>
            </div>
            <div className="w-[160px]">
              <Label className="mb-1.5 block text-xs text-muted-foreground">App</Label>
              <Select
                value={appFilter}
                onChange={(e) => { setAppFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Apps</option>
                {apps?.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
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
          ) : !devicesData?.data?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Monitor className="mb-4 h-12 w-12 opacity-40" />
              <p className="text-lg font-medium">No devices found</p>
              <p className="text-sm">Add your first device to get started</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>MAC Address</TableHead>
                    <TableHead>App</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Activated</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devicesData.data.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell>
                        <div>
                          <span className="font-mono font-medium">{device.macAddress}</span>
                          {device.notes && (
                            <p className="mt-0.5 text-xs text-muted-foreground truncate max-w-[200px]">
                              {device.notes}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{device.app?.name || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={device.packageType === "lifetime" ? "default" : "secondary"}>
                          {device.packageType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_COLORS[device.status] || "secondary"}>
                          {device.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {device.expiresAt ? formatDate(device.expiresAt) : "Never"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(device.activatedAt)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {device.packageType === "yearly" && (
                              <DropdownMenuItem
                                onClick={() => renewMutation.mutate(device.id)}
                              >
                                <RefreshCw className="mr-2 h-4 w-4" /> Renew
                              </DropdownMenuItem>
                            )}
                            {device.status === "active" ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  toggleMutation.mutate({ id: device.id, action: "disable" })
                                }
                              >
                                <PowerOff className="mr-2 h-4 w-4" /> Disable
                              </DropdownMenuItem>
                            ) : device.status === "disabled" ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  toggleMutation.mutate({ id: device.id, action: "enable" })
                                }
                              >
                                <Power className="mr-2 h-4 w-4" /> Enable
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                if (confirm("Delete this device?")) {
                                  deleteMutation.mutate(device.id);
                                }
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {devicesData.totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * 15 + 1}–
                    {Math.min(page * 15, devicesData.total)} of {devicesData.total}
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

      {/* Add Device Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent onClose={() => setAddOpen(false)}>
          <DialogHeader>
            <DialogTitle>Add New Device</DialogTitle>
            <DialogDescription>
              Activate a new IPTV device by entering its MAC address
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((data) => {
              const cleaned = {
                ...data,
                macAddressAlt: data.macAddressAlt || undefined,
                playlistUrl: data.playlistUrl || undefined,
                notes: data.notes || undefined,
              };
              addMutation.mutate(cleaned);
            })}
            className="mt-4 space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>App *</Label>
                <Select {...form.register("appId")} error={form.formState.errors.appId?.message}>
                  <option value="">Select app...</option>
                  {apps?.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Package *</Label>
                <Select {...form.register("packageType")}>
                  <option value="yearly">Yearly</option>
                  <option value="lifetime">Lifetime</option>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>MAC Address *</Label>
              <MacInput
                error={form.formState.errors.macAddress?.message}
                value={form.watch("macAddress")}
                onChange={(val) =>
                  form.setValue("macAddress", val, { shouldValidate: true })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Alternate MAC (optional)</Label>
              <MacInput
                error={form.formState.errors.macAddressAlt?.message}
                value={form.watch("macAddressAlt") || ""}
                onChange={(val) =>
                  form.setValue("macAddressAlt", val, { shouldValidate: true })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Playlist URL (optional)</Label>
              <Input
                placeholder="https://..."
                error={form.formState.errors.playlistUrl?.message}
                {...form.register("playlistUrl")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Customer name, location..."
                {...form.register("notes")}
              />
            </div>

            {creditCost > 0 && (
              <div className="rounded-md bg-muted p-3 text-center">
                <p className="text-sm text-muted-foreground">Cost</p>
                <p className="text-2xl font-bold text-primary">{creditCost} credits</p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={addMutation.isPending}>
                Activate Device
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
