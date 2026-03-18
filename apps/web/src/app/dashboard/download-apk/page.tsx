"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Smartphone, Copy } from "lucide-react";
import { toast } from "sonner";

interface ApkPlan {
  id: string;
  appName: string;
  appSlug: string;
  iconUrl: string;
  downloaderCode: string;
  apkUrl: string;
  version?: string;
  packageName?: string;
}

export default function DownloadApkPage() {
  const { data: apkPlans, isLoading } = useQuery<ApkPlan[]>({
    queryKey: ["apk-plans"],
    queryFn: async () => (await api.get("/apps/apk-plans")).data,
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Downloader code copied to clipboard");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Download APK</h2>
        <p className="text-muted-foreground">Download the latest APK files for supported apps</p>
      </div>

      {/* APK Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-lg" />
          ))}
        </div>
      ) : !apkPlans?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Smartphone className="mb-4 h-12 w-12 opacity-40" />
            <p className="text-lg font-medium">No APK downloads available</p>
            <p className="text-sm">Check back later for new app releases</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {apkPlans.map((plan) => (
            <Card key={plan.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {/* Card Header with App Icon */}
              <div className="bg-gradient-to-br from-red-600 to-red-700 p-6 flex flex-col items-center">
                {plan.iconUrl ? (
                  <img
                    src={plan.iconUrl}
                    alt={plan.appName}
                    className="h-20 w-20 rounded-xl object-contain bg-white p-2 shadow-md"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-xl bg-white/20 flex items-center justify-center">
                    <Smartphone className="h-10 w-10 text-white" />
                  </div>
                )}
                <h3 className="mt-3 text-lg font-bold text-white text-center">{plan.appName}</h3>
                {plan.version && (
                  <span className="mt-1 text-xs text-white/80">v{plan.version}</span>
                )}
              </div>

              {/* Card Body */}
              <CardContent className="p-4 space-y-4">
                {/* Downloader Code */}
                <div className="flex items-center justify-between rounded-md bg-gray-50 border px-3 py-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Downloader Code</p>
                    <p className="font-mono font-bold text-lg tracking-wider">{plan.downloaderCode}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => copyCode(plan.downloaderCode)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>

                {/* Download Button */}
                <Button
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => {
                    window.open(plan.apkUrl, "_blank");
                  }}
                >
                  <Download className="mr-2 h-4 w-4" /> Download APK
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
