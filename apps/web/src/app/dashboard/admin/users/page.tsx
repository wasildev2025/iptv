"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { AdminUser, UserStats, PaginatedResponse } from "@/types";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Search, MoreHorizontal, Users, Eye, Edit, Power, PowerOff,
  KeyRound, ChevronLeft, ChevronRight, ShieldCheck, UserCheck, UserX,
  Crown, Store, UserCog,
} from "lucide-react";

const ROLE_BADGE: Record<string, { label: string; variant: "destructive" | "default" | "secondary" }> = {
  admin: { label: "Admin", variant: "destructive" },
  reseller: { label: "Reseller", variant: "default" },
  sub_reseller: { label: "Sub-Reseller", variant: "secondary" },
};

export default function AdminUsersPage() {
  const queryClient = useQueryClient();

  // Filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Dialog states
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [selected, setSelected] = useState<AdminUser | null>(null);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editProfitMargin, setEditProfitMargin] = useState(0);
  const [editEmailVerified, setEditEmailVerified] = useState(false);
  const [editIsActive, setEditIsActive] = useState(false);

  // Reset password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // ---------- Queries ----------

  const { data: usersData, isLoading } = useQuery<PaginatedResponse<AdminUser>>({
    queryKey: ["admin-users", page, search, roleFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      if (statusFilter) params.set("status", statusFilter);
      return (await api.get(`/admin/users?${params}`)).data;
    },
  });

  const { data: stats } = useQuery<UserStats>({
    queryKey: ["admin-users-stats"],
    queryFn: async () => (await api.get("/admin/users/stats")).data,
  });

  const { data: userDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["admin-user-detail", selected?.id],
    queryFn: async () => (await api.get(`/admin/users/${selected!.id}`)).data,
    enabled: viewOpen && !!selected?.id,
  });

  // ---------- Mutations ----------

  const updateMutation = useMutation({
    mutationFn: (data: {
      name?: string;
      role?: string;
      profitMargin?: number;
      emailVerified?: boolean;
      isActive?: boolean;
    }) => api.put(`/admin/users/${selected!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users-stats"] });
      setEditOpen(false);
      toast.success("User updated successfully");
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Update failed"),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/users/${id}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users-stats"] });
      toast.success("User status toggled");
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Toggle failed"),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (data: { userId: string; newPassword: string }) =>
      api.post(`/admin/users/${data.userId}/reset-password`, { newPassword: data.newPassword }),
    onSuccess: () => {
      setResetPwOpen(false);
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password reset successfully");
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Password reset failed"),
  });

  // ---------- Handlers ----------

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const openEdit = (user: AdminUser) => {
    setSelected(user);
    setEditName(user.name);
    setEditRole(user.role);
    setEditProfitMargin(Number(user.profitMargin));
    setEditEmailVerified(user.emailVerified);
    setEditIsActive(user.isActive);
    setEditOpen(true);
  };

  const handleEditSubmit = () => {
    updateMutation.mutate({
      name: editName,
      role: editRole,
      profitMargin: editProfitMargin,
      emailVerified: editEmailVerified,
      isActive: editIsActive,
    });
  };

  const handleResetPassword = () => {
    if (!newPassword) {
      toast.error("Please enter a new password");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    resetPasswordMutation.mutate({ userId: selected!.id, newPassword });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">User Management</h2>
        <p className="text-muted-foreground">Manage all users across the platform</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <UserCheck className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <UserX className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Disabled</p>
                  <p className="text-2xl font-bold text-red-600">{stats.disabled}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Crown className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Admins</p>
                  <p className="text-2xl font-bold">{stats.admins}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Resellers</p>
                  <p className="text-2xl font-bold">{stats.resellers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <UserCog className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Sub-Resellers</p>
                  <p className="text-2xl font-bold">{stats.subResellers}</p>
                </div>
              </div>
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
            <div className="w-[160px]">
              <Label className="mb-1.5 block text-xs text-muted-foreground">Role</Label>
              <Select
                value={roleFilter}
                onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Roles</option>
                <option value="admin">Admin</option>
                <option value="reseller">Reseller</option>
                <option value="sub_reseller">Sub-Reseller</option>
              </Select>
            </div>
            <div className="w-[160px]">
              <Label className="mb-1.5 block text-xs text-muted-foreground">Status</Label>
              <Select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !usersData?.data?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="mb-4 h-12 w-12 opacity-40" />
              <p className="text-lg font-medium">No users found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead className="text-right">Devices</TableHead>
                    <TableHead className="text-right">Sub-Resellers</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersData.data.map((user) => {
                    const roleBadge = ROLE_BADGE[user.role] || { label: user.role, variant: "secondary" as const };
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{user.name}</span>
                            {user.parent && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Parent: {user.parent.name}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            {user.email}
                            {user.emailVerified && (
                              <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={roleBadge.variant}>
                            {roleBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(user.creditBalance)}
                        </TableCell>
                        <TableCell className="text-right">
                          {user._count.devices}
                        </TableCell>
                        <TableCell className="text-right">
                          {user._count.subResellers}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? "success" : "destructive"}>
                            {user.isActive ? "Active" : "Disabled"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setSelected(user); setViewOpen(true); }}>
                                <Eye className="mr-2 h-4 w-4" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(user)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => toggleMutation.mutate(user.id)}
                              >
                                {user.isActive ? (
                                  <><PowerOff className="mr-2 h-4 w-4" /> Disable</>
                                ) : (
                                  <><Power className="mr-2 h-4 w-4" /> Enable</>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelected(user);
                                  setNewPassword("");
                                  setConfirmPassword("");
                                  setResetPwOpen(true);
                                }}
                              >
                                <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {usersData.totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * 20 + 1}&ndash;
                    {Math.min(page * 20, usersData.total)} of {usersData.total}
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
                      {page} / {usersData.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= usersData.totalPages}
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

      {/* View User Detail Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent onClose={() => setViewOpen(false)} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription>{selected?.email}</DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : userDetail ? (
            <div className="mt-4 space-y-5">
              {/* User Info Grid */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Role</p>
                  <Badge variant={ROLE_BADGE[userDetail.role]?.variant || "secondary"} className="mt-1">
                    {ROLE_BADGE[userDetail.role]?.label || userDetail.role}
                  </Badge>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Credits</p>
                  <p className="text-xl font-bold">{Number(userDetail.creditBalance)}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Profit Margin</p>
                  <p className="text-xl font-bold">{Number(userDetail.profitMargin)}%</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={userDetail.isActive ? "success" : "destructive"} className="mt-1">
                    {userDetail.isActive ? "Active" : "Disabled"}
                  </Badge>
                </div>
              </div>

              {/* Additional Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Email Verified</span>
                  <span>{userDetail.emailVerified ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Devices</span>
                  <span>{userDetail._count?.devices ?? 0}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Sub-Resellers</span>
                  <span>{userDetail._count?.subResellers ?? 0}</span>
                </div>
                {userDetail.parent && (
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Parent</span>
                    <span>{userDetail.parent.name} ({userDetail.parent.email})</span>
                  </div>
                )}
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Last Login</span>
                  <span>{userDetail.lastLoginAt ? formatDate(userDetail.lastLoginAt) : "Never"}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatDate(userDetail.createdAt)}</span>
                </div>
              </div>

              {/* Recent Activity */}
              {userDetail.recentActivity?.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Recent Activity</p>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {userDetail.recentActivity.map((activity: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <span>{activity.action}</span>
                        <span className="text-muted-foreground">
                          {formatDate(activity.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent onClose={() => setEditOpen(false)}>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update details for {selected?.name}</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
              >
                <option value="admin">Admin</option>
                <option value="reseller">Reseller</option>
                <option value="sub_reseller">Sub-Reseller</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Profit Margin (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={editProfitMargin}
                onChange={(e) => setEditProfitMargin(Number(e.target.value))}
              />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editEmailVerified}
                  onChange={(e) => setEditEmailVerified(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Email Verified
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Active
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleEditSubmit}
                isLoading={updateMutation.isPending}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPwOpen} onOpenChange={setResetPwOpen}>
        <DialogContent onClose={() => setResetPwOpen(false)}>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selected?.name} ({selected?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input
                type="password"
                placeholder="Minimum 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetPwOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleResetPassword}
                isLoading={resetPasswordMutation.isPending}
              >
                Reset Password
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
