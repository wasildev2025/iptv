"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { App, PaginatedResponse } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MacInput } from "@/components/ui/mac-input";
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
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  History,
  Info,
} from "lucide-react";

const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

const switchMacSchema = z.object({
  application: z.string().min(1, "Please select an application"),
  old_mac: z
    .string()
    .min(1, "Current MAC address is required")
    .regex(macRegex, "Invalid MAC address format (XX:XX:XX:XX:XX:XX)"),
  new_mac: z
    .string()
    .min(1, "New MAC address is required")
    .regex(macRegex, "Invalid MAC address format (XX:XX:XX:XX:XX:XX)"),
});

type SwitchMacForm = z.infer<typeof switchMacSchema>;

interface SwitchInfo {
  allowed: number;
  used: number;
  remaining: number;
}

interface SwitchHistoryItem {
  id: string;
  application: string;
  appName?: string;
  old_mac: string;
  new_mac: string;
  status: "success" | "failed";
  errorMessage?: string;
  createdAt: string;
}

export default function SwitchMacPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data: apps } = useQuery<App[]>({
    queryKey: ["apps-allowed"],
    queryFn: async () => (await api.get("/apps/allowed")).data,
  });

  const { data: switchInfo, isLoading: infoLoading } = useQuery<SwitchInfo>({
    queryKey: ["mac-switch-info"],
    queryFn: async () => (await api.get("/mac-switch/info")).data,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<
    PaginatedResponse<SwitchHistoryItem>
  >({
    queryKey: ["mac-switch-history", page],
    queryFn: async () =>
      (await api.get(`/mac-switch/history?page=${page}&per_page=10`)).data,
  });

  const form = useForm<SwitchMacForm>({
    resolver: zodResolver(switchMacSchema),
    defaultValues: { application: "", old_mac: "", new_mac: "" },
  });

  const switchMutation = useMutation({
    mutationFn: (data: SwitchMacForm) => api.post("/mac-switch/switch", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mac-switch-info"] });
      queryClient.invalidateQueries({ queryKey: ["mac-switch-history"] });
      form.reset();
      toast.success("MAC address switched successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to switch MAC address");
    },
  });

  const remaining = switchInfo?.remaining ?? 0;
  const used = switchInfo?.used ?? 0;
  const allowed = switchInfo?.allowed ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Switch MAC Address</h2>
        <p className="text-muted-foreground">
          Replace a device MAC address with a new one
        </p>
      </div>

      {/* Switch Allowance Banner */}
      {infoLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
          <CardContent className="flex items-center gap-3 p-4">
            <Info className="h-5 w-5 text-red-600" />
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              {remaining} switches remaining ({used}/{allowed} used)
            </p>
          </CardContent>
        </Card>
      )}

      {/* Switch Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Switch MAC Address</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit((data) => switchMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label>Select Application *</Label>
              <Select
                {...form.register("application")}
                error={form.formState.errors.application?.message}
              >
                <option value="">Select application...</option>
                {apps?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Current MAC Address *</Label>
                <MacInput
                  error={form.formState.errors.old_mac?.message}
                  value={form.watch("old_mac")}
                  onChange={(val) =>
                    form.setValue("old_mac", val, { shouldValidate: true })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>New MAC Address *</Label>
                <MacInput
                  error={form.formState.errors.new_mac?.message}
                  value={form.watch("new_mac")}
                  onChange={(val) =>
                    form.setValue("new_mac", val, { shouldValidate: true })
                  }
                />
              </div>
            </div>

            <Button
              type="submit"
              className="bg-red-600 hover:bg-red-700"
              isLoading={switchMutation.isPending}
              disabled={remaining <= 0}
            >
              <ArrowLeftRight className="mr-2 h-4 w-4" /> Switch MAC Address
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Switch History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" /> Switch History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {historyLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !historyData?.data?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ArrowLeftRight className="mb-4 h-12 w-12 opacity-40" />
              <p className="text-lg font-medium">No switch history</p>
              <p className="text-sm">
                Your MAC address switch history will appear here
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Application</TableHead>
                    <TableHead>Old MAC</TableHead>
                    <TableHead>New MAC</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Error Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyData.data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.appName || item.application}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {item.old_mac}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {item.new_mac}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status === "success" ? "success" : "destructive"
                          }
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(item.createdAt)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {item.errorMessage || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {historyData.totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * 10 + 1}–
                    {Math.min(page * 10, historyData.total)} of{" "}
                    {historyData.total}
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
                      {page} / {historyData.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= historyData.totalPages}
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
