"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { SubReseller, PaginatedResponse } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  UserPlus, Search, MoreHorizontal, Users, Edit, Trash2,
  Power, PowerOff, Eye, ChevronLeft, ChevronRight,
} from "lucide-react";

const createSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/, {
      message: "Must include uppercase, lowercase, number, and special character",
    }),
  profitMargin: z.coerce.number().min(0).max(100).optional(),
});
type CreateForm = z.infer<typeof createSchema>;

const editSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  profitMargin: z.coerce.number().min(0).max(100).optional(),
});
type EditForm = z.infer<typeof editSchema>;

export default function ResellersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<SubReseller | null>(null);

  // Fetch resellers
  const { data: resellersData, isLoading } = useQuery<PaginatedResponse<SubReseller>>({
    queryKey: ["resellers", page, search, activeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (search) params.set("search", search);
      if (activeFilter) params.set("isActive", activeFilter);
      return (await api.get(`/resellers?${params}`)).data;
    },
  });

  // Hierarchy stats
  const { data: stats } = useQuery({
    queryKey: ["reseller-hierarchy-stats"],
    queryFn: async () => (await api.get("/resellers/hierarchy-stats")).data,
  });

  // Detail
  const { data: detail } = useQuery({
    queryKey: ["reseller-detail", selected?.id],
    queryFn: async () => (await api.get(`/resellers/${selected!.id}`)).data,
    enabled: detailOpen && !!selected?.id,
  });

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { profitMargin: 0 },
  });

  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateForm) => api.post("/resellers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resellers"] });
      queryClient.invalidateQueries({ queryKey: ["reseller-hierarchy-stats"] });
      setCreateOpen(false);
      createForm.reset();
      toast.success("Sub-reseller created");
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Create failed"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: EditForm) => api.put(`/resellers/${selected!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resellers"] });
      setEditOpen(false);
      toast.success("Sub-reseller updated");
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Update failed"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/resellers/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resellers"] });
      toast.success("Status updated");
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/resellers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resellers"] });
      queryClient.invalidateQueries({ queryKey: ["reseller-hierarchy-stats"] });
      toast.success("Sub-reseller deleted");
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Delete failed"),
  });

  const handleSearch = () => { setSearch(searchInput); setPage(1); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sub-Resellers</h2>
          <p className="text-muted-foreground">Manage your reseller network</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" /> Add Sub-Reseller
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Sub-Resellers</p>
              <p className="text-2xl font-bold">{stats.totalSubResellers}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-green-600">{stats.activeSubResellers}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Child Credits</p>
              <p className="text-2xl font-bold">{stats.totalChildCredits}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Child Devices</p>
              <p className="text-2xl font-bold">{stats.totalChildDevices}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label className="mb-1.5 block text-xs text-muted-foreground">Search</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Name or email..."
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
                value={activeFilter}
                onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
              >
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Disabled</option>
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
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !resellersData?.data?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="mb-4 h-12 w-12 opacity-40" />
              <p className="text-lg font-medium">No sub-resellers yet</p>
              <p className="text-sm">Create your first sub-reseller to grow your network</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead className="text-right">Devices</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resellersData.data.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.email}</TableCell>
                      <TableCell className="text-right font-mono">{Number(r.creditBalance)}</TableCell>
                      <TableCell className="text-right">{r.deviceCount}</TableCell>
                      <TableCell className="text-right">{Number(r.profitMargin)}%</TableCell>
                      <TableCell>
                        <Badge variant={r.isActive ? "success" : "destructive"}>
                          {r.isActive ? "Active" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(r.createdAt)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelected(r); setDetailOpen(true); }}>
                              <Eye className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelected(r);
                              editForm.reset({ name: r.name, profitMargin: Number(r.profitMargin) });
                              setEditOpen(true);
                            }}>
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => toggleMutation.mutate({ id: r.id, isActive: !r.isActive })}
                            >
                              {r.isActive ? (
                                <><PowerOff className="mr-2 h-4 w-4" /> Disable</>
                              ) : (
                                <><Power className="mr-2 h-4 w-4" /> Enable</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                if (confirm(`Delete ${r.name}? This cannot be undone.`)) {
                                  deleteMutation.mutate(r.id);
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

              {resellersData.totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {resellersData.totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= resellersData.totalPages} onClick={() => setPage(page + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent onClose={() => setCreateOpen(false)}>
          <DialogHeader>
            <DialogTitle>Create Sub-Reseller</DialogTitle>
            <DialogDescription>Add a new reseller to your network</DialogDescription>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input error={createForm.formState.errors.name?.message} {...createForm.register("name")} />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" error={createForm.formState.errors.email?.message} {...createForm.register("email")} />
            </div>
            <div className="space-y-1.5">
              <Label>Password *</Label>
              <Input type="password" error={createForm.formState.errors.password?.message} {...createForm.register("password")} />
            </div>
            <div className="space-y-1.5">
              <Label>Profit Margin (%)</Label>
              <Input type="number" min={0} max={100} {...createForm.register("profitMargin")} />
              <p className="text-xs text-muted-foreground">
                Percentage markup on device activation cost for this sub-reseller
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={createMutation.isPending}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent onClose={() => setEditOpen(false)}>
          <DialogHeader>
            <DialogTitle>Edit {selected?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit((d) => updateMutation.mutate(d))} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input {...editForm.register("name")} />
            </div>
            <div className="space-y-1.5">
              <Label>Profit Margin (%)</Label>
              <Input type="number" min={0} max={100} {...editForm.register("profitMargin")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={updateMutation.isPending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent onClose={() => setDetailOpen(false)} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription>{selected?.email}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Credits</p>
                  <p className="text-xl font-bold">{detail.creditBalance}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Devices</p>
                  <p className="text-xl font-bold">{detail.deviceCount}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Margin</p>
                  <p className="text-xl font-bold">{detail.profitMargin}%</p>
                </div>
              </div>

              {detail.stats?.devicesByStatus && Object.keys(detail.stats.devicesByStatus).length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Devices by Status</p>
                  <div className="flex gap-2">
                    {Object.entries(detail.stats.devicesByStatus).map(([status, count]) => (
                      <Badge key={status} variant={(
                        { active: "success", expired: "destructive", disabled: "warning", trial: "secondary" } as Record<string, any>
                      )[status] || "secondary"}>
                        {status}: {count as number}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {detail.recentActivity?.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Recent Activity</p>
                  <div className="space-y-2">
                    {detail.recentActivity.map((a: any, i: number) => (
                      <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <span>{a.action}</span>
                        <span className="text-muted-foreground">{formatDate(a.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
