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
import {
  Search,
  Plus,
  Shield,
  ListMusic,
} from "lucide-react";

interface DeviceStatus {
  found: boolean;
  macAddress: string;
  appName: string;
  status: string;
  expiresAt?: string;
  playlists?: Array<{
    id: string;
    name: string;
    url: string;
  }>;
}

export default function PlaylistsPage() {
  const [selectedApp, setSelectedApp] = useState("");
  const [macAddress, setMacAddress] = useState("");
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Playlist form state
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [playlistName, setPlaylistName] = useState("");
  const [xmlUrl, setXmlUrl] = useState("");
  const [pin, setPin] = useState("");
  const [isProtected, setIsProtected] = useState(false);

  const { data: apps } = useQuery<App[]>({
    queryKey: ["apps"],
    queryFn: async () => (await api.get("/apps")).data,
  });

  const checkStatusMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/playlists/check-status", {
        appId: selectedApp,
        macAddress,
      });
      return res.data as DeviceStatus;
    },
    onSuccess: (data) => {
      setDeviceStatus(data);
      setShowAddForm(false);
      toast.success("Device found successfully");
    },
    onError: (err: any) => {
      setDeviceStatus(null);
      toast.error(err.response?.data?.message || "Device not found or not activated");
    },
  });

  const addPlaylistMutation = useMutation({
    mutationFn: async () => {
      return api.post("/playlists/save", {
        appId: selectedApp,
        macAddress,
        playlistUrl,
        playlistName,
        xmlUrl: xmlUrl || undefined,
        pin: pin || undefined,
        isProtected,
      });
    },
    onSuccess: () => {
      toast.success("Playlist added successfully");
      resetPlaylistForm();
      // Re-check status to refresh the playlists list
      checkStatusMutation.mutate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to add playlist");
    },
  });

  const resetPlaylistForm = () => {
    setPlaylistUrl("");
    setPlaylistName("");
    setXmlUrl("");
    setPin("");
    setIsProtected(false);
    setShowAddForm(false);
  };

  const handleCheckStatus = () => {
    if (!selectedApp) {
      toast.error("Please select a module");
      return;
    }
    if (!macAddress.trim()) {
      toast.error("Please enter a MAC address");
      return;
    }
    checkStatusMutation.mutate();
  };

  const handleAddPlaylist = () => {
    if (!playlistUrl.trim()) {
      toast.error("Playlist URL is required");
      return;
    }
    if (!playlistName.trim()) {
      toast.error("Playlist name is required");
      return;
    }
    addPlaylistMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Add Playlist</h2>
        <p className="text-muted-foreground">Add playlists to activated devices</p>
      </div>

      {/* Check Status Form */}
      <Card>
        <CardHeader className="bg-red-600 text-white rounded-t-lg py-3 px-4">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Search className="h-4 w-4" /> Check Device & Add Playlist
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Select Module *</Label>
              <Select
                value={selectedApp}
                onChange={(e) => {
                  setSelectedApp(e.target.value);
                  setDeviceStatus(null);
                  setShowAddForm(false);
                }}
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
            <div className="flex items-end gap-2">
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleCheckStatus}
                disabled={checkStatusMutation.isPending}
              >
                <Search className="mr-2 h-4 w-4" />
                {checkStatusMutation.isPending ? "Checking..." : "Check Status"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (!deviceStatus) {
                    toast.error("Please check device status first");
                    return;
                  }
                  setShowAddForm(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Add Playlist
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Device Status Display */}
      {deviceStatus && (
        <Card>
          <CardHeader className="bg-gray-100 py-3 px-4">
            <CardTitle className="text-base font-medium">Device Information</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">App Name</p>
                <p className="font-medium">{deviceStatus.appName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">MAC Address</p>
                <p className="font-mono font-medium">{deviceStatus.macAddress}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="font-medium capitalize">{deviceStatus.status}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Expiry Date</p>
                <p className="font-medium">{deviceStatus.expiresAt || "Lifetime"}</p>
              </div>
            </div>

            {/* Existing playlists */}
            {deviceStatus.playlists && deviceStatus.playlists.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold mb-2">Existing Playlists</h4>
                <div className="space-y-2">
                  {deviceStatus.playlists.map((pl) => (
                    <div key={pl.id} className="flex items-center gap-3 rounded-md border p-3">
                      <ListMusic className="h-4 w-4 text-red-600" />
                      <div>
                        <p className="font-medium text-sm">{pl.name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[400px]">{pl.url}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Playlist Form */}
      {showAddForm && deviceStatus && (
        <Card>
          <CardHeader className="bg-red-600 text-white rounded-t-lg py-3 px-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Plus className="h-4 w-4" /> New Playlist Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Playlist URL *</Label>
                <Input
                  placeholder="http://example.com/playlist.m3u"
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Playlist Name *</Label>
                <Input
                  placeholder="My Playlist"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>XML URL (optional)</Label>
                <Input
                  placeholder="http://example.com/epg.xml"
                  value={xmlUrl}
                  onChange={(e) => setXmlUrl(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>PIN (optional)</Label>
                <Input
                  placeholder="Enter PIN"
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={isProtected}
                onClick={() => setIsProtected(!isProtected)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  isProtected ? "bg-red-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${
                    isProtected ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <Label className="flex items-center gap-1">
                <Shield className="h-4 w-4" /> Protected
              </Label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleAddPlaylist}
                disabled={addPlaylistMutation.isPending}
              >
                {addPlaylistMutation.isPending ? "Saving..." : "Save Playlist"}
              </Button>
              <Button variant="outline" onClick={resetPlaylistForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
