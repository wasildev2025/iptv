"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { App, Device } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MacInput } from "@/components/ui/mac-input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Zap,
  CheckCircle,
  AlertTriangle,
  Package,
  Monitor,
} from "lucide-react";

const MAX_APPS = 4;

const multiActivateSchema = z.object({
  macAddress: z
    .string()
    .min(1, "MAC address is required")
    .regex(
      /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
      "Invalid MAC address format (XX:XX:XX:XX:XX:XX)"
    ),
  remarks: z.string().max(500).optional(),
});

type MultiActivateForm = z.infer<typeof multiActivateSchema>;

interface ActivationResult {
  devices: Device[];
  totalCreditsUsed: number;
}

export default function MultiAppsActivationPage() {
  const queryClient = useQueryClient();
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [packageType, setPackageType] = useState<"yearly" | "lifetime">(
    "yearly"
  );
  const [result, setResult] = useState<ActivationResult | null>(null);

  const { data: apps, isLoading: appsLoading } = useQuery<App[]>({
    queryKey: ["apps-allowed"],
    queryFn: async () => (await api.get("/apps/allowed")).data,
  });

  const form = useForm<MultiActivateForm>({
    resolver: zodResolver(multiActivateSchema),
    defaultValues: { macAddress: "", remarks: "" },
  });

  const activateMutation = useMutation({
    mutationFn: (data: MultiActivateForm) =>
      api.post("/devices/multi-activate", {
        macAddress: data.macAddress,
        appIds: selectedApps,
        packageType,
        remarks: data.remarks || undefined,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setResult(res.data);
      toast.success("Devices activated successfully");
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message || "Failed to activate devices"
      );
    },
  });

  const toggleApp = (appId: string) => {
    setSelectedApps((prev) => {
      if (prev.includes(appId)) {
        return prev.filter((id) => id !== appId);
      }
      if (prev.length >= MAX_APPS) {
        toast.error(`You can select a maximum of ${MAX_APPS} apps`);
        return prev;
      }
      return [...prev, appId];
    });
  };

  const totalCredits = selectedApps.reduce((sum, appId) => {
    const app = apps?.find((a) => a.id === appId);
    if (!app) return sum;
    return sum + (packageType === "yearly" ? app.creditsYearly : app.creditsLifetime);
  }, 0);

  const handleSubmit = (data: MultiActivateForm) => {
    if (selectedApps.length === 0) {
      toast.error("Please select at least one app");
      return;
    }
    activateMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Multi Apps Activation</h2>
        <p className="text-muted-foreground">
          Activate multiple apps on a single device at once
        </p>
      </div>

      {/* Warning Notice */}
      <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
        <CardContent className="flex items-center gap-3 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600" />
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Please note that each App should be installed before activating!
          </p>
        </CardContent>
      </Card>

      {/* Success Result */}
      {result && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-green-800 dark:text-green-200">
              <CheckCircle className="h-5 w-5" /> Activation Successful
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-green-700 dark:text-green-300">
              {result.devices.length} device(s) activated. Total credits used:{" "}
              <strong>{result.totalCreditsUsed}</strong>
            </p>
            <div className="space-y-2">
              {result.devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between rounded-md border border-green-200 bg-white p-3 dark:border-green-800 dark:bg-green-900/30"
                >
                  <div className="flex items-center gap-3">
                    <Monitor className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium">
                        {device.app?.name || "App"}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {device.macAddress}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="success">{device.status}</Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {device.expiresAt
                        ? `Expires ${formatDate(device.expiresAt)}`
                        : "Lifetime"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setResult(null);
                setSelectedApps([]);
                form.reset();
              }}
            >
              Activate Another
            </Button>
          </CardContent>
        </Card>
      )}

      {!result && (
        <>
          {/* App Selection Grid */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Select Applications (max {MAX_APPS})
                </CardTitle>
                {selectedApps.length > 0 && (
                  <Badge variant="secondary">
                    {selectedApps.length} / {MAX_APPS} selected
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {appsLoading ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-28 w-full rounded-lg" />
                  ))}
                </div>
              ) : !apps?.length ? (
                <p className="py-8 text-center text-muted-foreground">
                  No apps available
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {apps.map((app) => {
                    const isSelected = selectedApps.includes(app.id);
                    return (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => toggleApp(app.id)}
                        className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:shadow-md ${
                          isSelected
                            ? "border-red-600 bg-red-50 shadow-sm dark:bg-red-950"
                            : "border-transparent bg-muted/50 hover:border-gray-300"
                        }`}
                      >
                        {app.iconUrl ? (
                          <img
                            src={app.iconUrl}
                            alt={app.name}
                            className="h-12 w-12 rounded-lg object-contain"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900">
                            <Package className="h-6 w-6 text-red-600" />
                          </div>
                        )}
                        <span className="text-center text-xs font-medium leading-tight">
                          {app.name}
                        </span>
                        {isSelected && (
                          <CheckCircle className="h-4 w-4 text-red-600" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activation Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activation Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-4"
              >
                {/* Package Type */}
                <div className="space-y-1.5">
                  <Label>Package Type *</Label>
                  <div className="flex gap-4">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="packageType"
                        value="yearly"
                        checked={packageType === "yearly"}
                        onChange={() => setPackageType("yearly")}
                        className="h-4 w-4 text-red-600 accent-red-600"
                      />
                      <span className="text-sm font-medium">1-Year</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="packageType"
                        value="lifetime"
                        checked={packageType === "lifetime"}
                        onChange={() => setPackageType("lifetime")}
                        className="h-4 w-4 text-red-600 accent-red-600"
                      />
                      <span className="text-sm font-medium">Lifetime</span>
                    </label>
                  </div>
                </div>

                {/* Remarks */}
                <div className="space-y-1.5">
                  <Label>Remarks (optional)</Label>
                  <Input
                    placeholder="Customer name, notes..."
                    {...form.register("remarks")}
                  />
                </div>

                {/* MAC Address */}
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

                {/* Credit Cost Summary */}
                {selectedApps.length > 0 && (
                  <div className="rounded-md bg-muted p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {selectedApps.length} app(s) selected -{" "}
                          {packageType === "yearly" ? "1-Year" : "Lifetime"}{" "}
                          package
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Each app will consume credits from your balance
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          Total Cost
                        </p>
                        <p className="text-2xl font-bold text-red-600">
                          {totalCredits} credits
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-700"
                  isLoading={activateMutation.isPending}
                  disabled={selectedApps.length === 0}
                >
                  <Zap className="mr-2 h-4 w-4" /> Activate{" "}
                  {selectedApps.length > 0
                    ? `${selectedApps.length} App(s)`
                    : ""}
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
