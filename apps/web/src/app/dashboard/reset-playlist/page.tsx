"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import type { App } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MacInput } from "@/components/ui/mac-input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RotateCcw, AlertTriangle } from "lucide-react";

export default function ResetPlaylistPage() {
  const [selectedApp, setSelectedApp] = useState("");
  const [macAddress, setMacAddress] = useState("");
  const [playlistType, setPlaylistType] = useState<"playlist" | "xc_playlist">("playlist");
  const [deviceKey, setDeviceKey] = useState("");

  const { data: apps } = useQuery<App[]>({
    queryKey: ["apps"],
    queryFn: async () => (await api.get("/apps")).data,
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      return api.post("/playlists/reset", {
        appId: selectedApp,
        macAddress,
        playlistType,
        deviceKey,
      });
    },
    onSuccess: () => {
      toast.success("Playlist reset successfully");
      setMacAddress("");
      setDeviceKey("");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to reset playlist");
    },
  });

  const handleReset = () => {
    if (!selectedApp) {
      toast.error("Please select a module");
      return;
    }
    if (!macAddress.trim()) {
      toast.error("Please enter a MAC address");
      return;
    }
    if (!deviceKey.trim()) {
      toast.error("Please enter the device key");
      return;
    }
    if (!confirm("Are you sure you want to reset this playlist? This action cannot be undone.")) {
      return;
    }
    resetMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Reset Playlist</h2>
        <p className="text-muted-foreground">Reset playlist configuration for a device</p>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4">
        <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-yellow-800">Warning</p>
          <p className="text-sm text-yellow-700">
            Resetting a playlist will remove the current playlist configuration from the device.
            The device will need to be reconfigured with a new playlist after reset.
          </p>
        </div>
      </div>

      {/* Reset Form */}
      <Card>
        <CardHeader className="bg-red-600 text-white rounded-t-lg py-3 px-4">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <RotateCcw className="h-4 w-4" /> Reset Playlist
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Select Module *</Label>
              <Select
                value={selectedApp}
                onChange={(e) => setSelectedApp(e.target.value)}
              >
                <option value="">Select app...</option>
                {apps?.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>MAC Address *</Label>
              <MacInput value={macAddress} onChange={setMacAddress} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Select Playlist Type *</Label>
            <div className="flex items-center gap-6 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="playlistType"
                  value="playlist"
                  checked={playlistType === "playlist"}
                  onChange={() => setPlaylistType("playlist")}
                  className="h-4 w-4 text-red-600 accent-red-600"
                />
                <span className="text-sm font-medium">Playlist</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="playlistType"
                  value="xc_playlist"
                  checked={playlistType === "xc_playlist"}
                  onChange={() => setPlaylistType("xc_playlist")}
                  className="h-4 w-4 text-red-600 accent-red-600"
                />
                <span className="text-sm font-medium">XC Playlist</span>
              </label>
            </div>
          </div>

          <div className="space-y-1.5 max-w-md">
            <Label>Device Key *</Label>
            <Input
              placeholder="Enter device key"
              value={deviceKey}
              onChange={(e) => setDeviceKey(e.target.value)}
            />
          </div>

          <div className="pt-2">
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleReset}
              disabled={resetMutation.isPending}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {resetMutation.isPending ? "Resetting..." : "Reset Playlist"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
