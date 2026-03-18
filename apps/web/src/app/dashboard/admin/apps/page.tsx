"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import type { App } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Pencil,
  Power,
  PowerOff,
  Trash2,
  AppWindow,
} from "lucide-react";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

interface AppFormData {
  name: string;
  slug: string;
  iconUrl: string;
  creditsYearly: number;
  creditsLifetime: number;
}

const initialFormData: AppFormData = {
  name: "",
  slug: "",
  iconUrl: "",
  creditsYearly: 0,
  creditsLifetime: 0,
};

export default function AdminAppsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<App | null>(null);
  const [formData, setFormData] = useState<AppFormData>(initialFormData);
  const [autoSlug, setAutoSlug] = useState(true);

  // Fetch all apps (admin)
  const { data: apps, isLoading } = useQuery<App[]>({
    queryKey: ["admin-apps"],
    queryFn: async () => (await api.get("/apps/admin/all")).data,
  });

  // Filtered apps
  const filteredApps = apps?.filter((app) =>
    app.name.toLowerCase().includes(search.toLowerCase())
  );

  // Create app
  const createMutation = useMutation({
    mutationFn: (data: AppFormData) =>
      api.post("/apps/admin", {
        name: data.name,
        slug: data.slug,
        iconUrl: data.iconUrl || undefined,
        creditsYearly: data.creditsYearly,
        creditsLifetime: data.creditsLifetime,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-apps"] });
      setAddOpen(false);
      resetForm();
      toast.success("App created successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to create app");
    },
  });

  // Update app
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AppFormData> }) =>
      api.put(`/apps/admin/${id}`, {
        name: data.name,
        slug: data.slug,
        iconUrl: data.iconUrl || undefined,
        creditsYearly: data.creditsYearly,
        creditsLifetime: data.creditsLifetime,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-apps"] });
      setEditOpen(false);
      setEditingApp(null);
      resetForm();
      toast.success("App updated successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to update app");
    },
  });

  // Toggle active
  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/apps/admin/${id}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-apps"] });
      toast.success("App status toggled");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to toggle status");
    },
  });

  // Delete app
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/apps/admin/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-apps"] });
      toast.success("App deleted successfully");
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message || "Failed to delete app. It may have associated devices."
      );
    },
  });

  function resetForm() {
    setFormData(initialFormData);
    setAutoSlug(true);
  }

  function openEdit(app: App) {
    setEditingApp(app);
    setFormData({
      name: app.name,
      slug: app.slug,
      iconUrl: app.iconUrl || "",
      creditsYearly: app.creditsYearly,
      creditsLifetime: app.creditsLifetime,
    });
    setAutoSlug(false);
    setEditOpen(true);
  }

  function handleNameChange(value: string) {
    setFormData((prev) => ({
      ...prev,
      name: value,
      slug: autoSlug ? slugify(value) : prev.slug,
    }));
  }

  function handleSlugChange(value: string) {
    setAutoSlug(false);
    setFormData((prev) => ({ ...prev, slug: value }));
  }

  function handleSubmitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.slug.trim()) {
      toast.error("Name and slug are required");
      return;
    }
    createMutation.mutate(formData);
  }

  function handleSubmitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingApp || !formData.name.trim() || !formData.slug.trim()) {
      toast.error("Name and slug are required");
      return;
    }
    updateMutation.mutate({ id: editingApp.id, data: formData });
  }

  const formFields = (
    <>
      <div className="space-y-1.5">
        <Label>Name *</Label>
        <Input
          placeholder="App name"
          value={formData.name}
          onChange={(e) => handleNameChange(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label>Slug *</Label>
        <Input
          placeholder="app-slug"
          value={formData.slug}
          onChange={(e) => handleSlugChange(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          Auto-generated from name. Edit to customize.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Icon URL</Label>
        <Input
          placeholder="https://example.com/icon.png"
          value={formData.iconUrl}
          onChange={(e) => setFormData((prev) => ({ ...prev, iconUrl: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Credits (Yearly) *</Label>
          <Input
            type="number"
            min={0}
            placeholder="0"
            value={formData.creditsYearly}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, creditsYearly: Number(e.target.value) }))
            }
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Credits (Lifetime) *</Label>
          <Input
            type="number"
            min={0}
            placeholder="0"
            value={formData.creditsLifetime}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, creditsLifetime: Number(e.target.value) }))
            }
            required
          />
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">App Management</h2>
          <p className="text-muted-foreground">Manage IPTV applications and their credit pricing</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setAddOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Add App
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label className="mb-1.5 block text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search apps by name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
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
          ) : !filteredApps?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <AppWindow className="mb-4 h-12 w-12 opacity-40" />
              <p className="text-lg font-medium">
                {search ? "No apps match your search" : "No apps found"}
              </p>
              <p className="text-sm">
                {search ? "Try a different search term" : "Create your first app to get started"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Credits (Yearly / Lifetime)</TableHead>
                  <TableHead>Devices</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApps.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {app.iconUrl ? (
                          <img
                            src={app.iconUrl}
                            alt={app.name}
                            className="h-8 w-8 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                            <AppWindow className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="font-medium">{app.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-sm">{app.slug}</code>
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums">
                        {app.creditsYearly} / {app.creditsLifetime}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums">{app._count?.devices ?? 0}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={app.isActive ? "success" : "destructive"}>
                        {app.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(app)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleMutation.mutate(app.id)}>
                            {app.isActive ? (
                              <>
                                <PowerOff className="mr-2 h-4 w-4" /> Deactivate
                              </>
                            ) : (
                              <>
                                <Power className="mr-2 h-4 w-4" /> Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (
                                confirm(
                                  `Delete "${app.name}"? This will fail if the app has associated devices.`
                                )
                              ) {
                                deleteMutation.mutate(app.id);
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
          )}
        </CardContent>
      </Card>

      {/* Add App Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent onClose={() => setAddOpen(false)}>
          <DialogHeader>
            <DialogTitle>Add New App</DialogTitle>
            <DialogDescription>
              Create a new IPTV application with credit pricing
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitAdd} className="mt-4 space-y-4">
            {formFields}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={createMutation.isPending}>
                Create App
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit App Dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditingApp(null);
            resetForm();
          }
        }}
      >
        <DialogContent
          onClose={() => {
            setEditOpen(false);
            setEditingApp(null);
            resetForm();
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit App</DialogTitle>
            <DialogDescription>
              Update the app details and credit pricing
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitEdit} className="mt-4 space-y-4">
            {formFields}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditOpen(false);
                  setEditingApp(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={updateMutation.isPending}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
