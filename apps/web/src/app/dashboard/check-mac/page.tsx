"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { App } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MacInput } from "@/components/ui/mac-input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Monitor, User, Calendar, Smartphone } from "lucide-react";

const STATUS_COLORS: Record<string, "success" | "destructive" | "warning" | "secondary"> = {
  active: "success",
  expired: "destructive",
  disabled: "warning",
  trial: "secondary",
};

const checkMacSchema = z.object({
  appId: z.string().min(1, "Please select a module"),
  macAddress: z
    .string()
    .min(1, "MAC address is required")
    .regex(
      /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
      "Invalid MAC address format (XX:XX:XX:XX:XX:XX)"
    ),
});

type CheckMacForm = z.infer<typeof checkMacSchema>;

interface DeviceCheckResult {
  macAddress: string;
  status: string;
  expiresAt?: string;
  activatedAt?: string;
  packageType?: string;
  app?: { name: string; iconUrl: string };
  activatedBy?: string;
  notes?: string;
}

export default function CheckMacPage() {
  const [result, setResult] = useState<DeviceCheckResult | null>(null);

  const { data: apps, isLoading: appsLoading } = useQuery<App[]>({
    queryKey: ["apps-allowed"],
    queryFn: async () => (await api.get("/apps/allowed")).data,
  });

  const form = useForm<CheckMacForm>({
    resolver: zodResolver(checkMacSchema),
    defaultValues: { appId: "", macAddress: "" },
  });

  const checkMutation = useMutation({
    mutationFn: (data: CheckMacForm) =>
      api.post("/devices/check-status", {
        macAddress: data.macAddress,
        appId: data.appId,
      }),
    onSuccess: (res) => {
      setResult(res.data);
      toast.success("Device found");
    },
    onError: (err: any) => {
      setResult(null);
      toast.error(err.response?.data?.message || "Device not found");
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Check MAC</h2>
        <p className="text-muted-foreground">
          Check the status of a device by its MAC address
        </p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Device Lookup</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit((data) => checkMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Select Module *</Label>
                {appsLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select
                    {...form.register("appId")}
                    error={form.formState.errors.appId?.message}
                  >
                    <option value="">Select application...</option>
                    {apps?.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                )}
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
            </div>

            <Button
              type="submit"
              className="bg-red-600 hover:bg-red-700"
              isLoading={checkMutation.isPending}
            >
              <Search className="mr-2 h-4 w-4" /> Check Device
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Result */}
      {checkMutation.isPending && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </CardContent>
        </Card>
      )}

      {result && !checkMutation.isPending && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Device Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-red-50 p-2 dark:bg-red-950">
                  <Monitor className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">MAC Address</p>
                  <p className="font-mono font-medium">{result.macAddress}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-red-50 p-2 dark:bg-red-950">
                  <Smartphone className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Application</p>
                  <p className="font-medium">{result.app?.name || "Unknown"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-red-50 p-2 dark:bg-red-950">
                  <Search className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={STATUS_COLORS[result.status] || "secondary"}>
                    {result.status}
                  </Badge>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-red-50 p-2 dark:bg-red-950">
                  <Calendar className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expiry Date</p>
                  <p className="font-medium">
                    {result.expiresAt ? formatDate(result.expiresAt) : "Lifetime"}
                  </p>
                </div>
              </div>

              {result.activatedAt && (
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-red-50 p-2 dark:bg-red-950">
                    <Calendar className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Activated On</p>
                    <p className="font-medium">{formatDate(result.activatedAt)}</p>
                  </div>
                </div>
              )}

              {result.activatedBy && (
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-red-50 p-2 dark:bg-red-950">
                    <User className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Activated By</p>
                    <p className="font-medium">{result.activatedBy}</p>
                  </div>
                </div>
              )}

              {result.packageType && (
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-red-50 p-2 dark:bg-red-950">
                    <Smartphone className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Package</p>
                    <Badge
                      variant={result.packageType === "lifetime" ? "default" : "secondary"}
                    >
                      {result.packageType}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
