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
  Pencil,
  Trash2,
  X,
  Save,
} from "lucide-react";

interface ExistingPlaylist {
  id: string;
  name: string;
  url: string;
  xmlUrl: string;
  isProtected: boolean;
  createdAt: string;
}

interface DeviceStatus {
  found: boolean;
  macAddress: string;
  appId: string;
  appName: string;
  status: string;
  expiresAt?: string;
  playlists: ExistingPlaylist[];
}

interface PlaylistFormState {
  playlistUrl: string;
  playlistName: string;
  xmlUrl: string;
  pin: string;
  isProtected: boolean;
}

const emptyForm: PlaylistFormState = {
  playlistUrl: "",
  playlistName: "",
  xmlUrl: "",
  pin: "",
  isProtected: false,
};

export default function PlaylistsPage() {
  const [selectedApp, setSelectedApp] = useState("");
  const [macAddress, setMacAddress] = useState("");
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<PlaylistFormState>(emptyForm);

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
      setEditingId(null);
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
        playlistUrl: form.playlistUrl,
        playlistName: form.playlistName,
        xmlUrl: form.xmlUrl || undefined,
        pin: form.pin || undefined,
        isProtected: form.isProtected,
      });
    },
    onSuccess: () => {
      toast.success("Playlist added successfully");
      resetForm();
      checkStatusMutation.mutate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to add playlist");
    },
  });

  const updatePlaylistMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.patch(`/playlists/${id}`, {
        playlistUrl: form.playlistUrl,
        playlistName: form.playlistName,
        xmlUrl: form.xmlUrl,
        pin: form.pin || undefined,
        isProtected: form.isProtected,
      });
    },
    onSuccess: () => {
      toast.success("Playlist updated");
      resetForm();
      checkStatusMutation.mutate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to update playlist");
    },
  });

  const deletePlaylistMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/playlists/${id}`),
    onSuccess: () => {
      toast.success("Playlist deleted");
      checkStatusMutation.mutate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to delete playlist");
    },
  });

  const resetForm = () => {
    setForm(emptyForm);
    setShowAddForm(false);
    setEditingId(null);
  };

  const beginEdit = (p: ExistingPlaylist) => {
    setShowAddForm(false);
    setEditingId(p.id);
    setForm({
      playlistUrl: p.url,
      playlistName: p.name,
      xmlUrl: p.xmlUrl || "",
      pin: "",
      isProtected: p.isProtected,
    });
  };

  const beginAdd = () => {
    if (!deviceStatus) {
      toast.error("Please check device status first");
      return;
    }
    setEditingId(null);
    setForm(emptyForm);
    setShowAddForm(true);
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

  const handleSave = () => {
    if (!form.playlistUrl.trim()) {
      toast.error("Playlist URL is required");
      return;
    }
    if (!form.playlistName.trim()) {
      toast.error("Playlist name is required");
      return;
    }
    if (editingId) {
      updatePlaylistMutation.mutate(editingId);
    } else {
      addPlaylistMutation.mutate();
    }
  };

  const handleDelete = (p: ExistingPlaylist) => {
    if (!confirm(`Delete playlist "${p.name}"? This cannot be undone.`)) return;
    deletePlaylistMutation.mutate(p.id);
  };

  const isFormOpen = showAddForm || editingId !== null;
  const isSaving = addPlaylistMutation.isPending || updatePlaylistMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Add Playlist</h2>
        <p className="text-muted-foreground">Add playlists to activated devices</p>
      </div>

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
                  resetForm();
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
              <Button variant="outline" onClick={beginAdd}>
                <Plus className="mr-2 h-4 w-4" /> Add Playlist
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
                <p className="font-medium">
                  {deviceStatus.expiresAt
                    ? new Date(deviceStatus.expiresAt).toLocaleDateString()
                    : "Lifetime"}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-semibold mb-2">
                Existing Playlists ({deviceStatus.playlists.length})
              </h4>
              {deviceStatus.playlists.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No playlists yet. Click "Add Playlist" to create one.
                </p>
              ) : (
                <div className="space-y-2">
                  {deviceStatus.playlists.map((pl) => (
                    <div
                      key={pl.id}
                      className="flex items-start gap-3 rounded-md border p-3"
                    >
                      <ListMusic className="h-4 w-4 text-red-600 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{pl.name}</p>
                          {pl.isProtected && (
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-red-600 bg-red-50 rounded px-1.5 py-0.5">
                              <Shield className="h-3 w-3" /> Protected
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground break-all">
                          <span className="font-semibold">URL:</span> {pl.url}
                        </p>
                        {pl.xmlUrl && (
                          <p className="text-xs text-muted-foreground break-all">
                            <span className="font-semibold">EPG:</span> {pl.xmlUrl}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Added {new Date(pl.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => beginEdit(pl)}
                          disabled={isSaving || deletePlaylistMutation.isPending}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(pl)}
                          disabled={deletePlaylistMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isFormOpen && deviceStatus && (
        <Card>
          <CardHeader className="bg-red-600 text-white rounded-t-lg py-3 px-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              {editingId ? (
                <><Pencil className="h-4 w-4" /> Edit Playlist</>
              ) : (
                <><Plus className="h-4 w-4" /> New Playlist Details</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Playlist URL *</Label>
                <Input
                  placeholder="http://example.com/playlist.m3u"
                  value={form.playlistUrl}
                  onChange={(e) => setForm({ ...form, playlistUrl: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Playlist Name *</Label>
                <Input
                  placeholder="My Playlist"
                  value={form.playlistName}
                  onChange={(e) => setForm({ ...form, playlistName: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>XML URL (optional)</Label>
                <Input
                  placeholder="http://example.com/epg.xml"
                  value={form.xmlUrl}
                  onChange={(e) => setForm({ ...form, xmlUrl: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>PIN {editingId ? "(leave blank to keep current)" : "(optional)"}</Label>
                <Input
                  placeholder="Enter PIN"
                  type="password"
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={form.isProtected}
                onClick={() => setForm({ ...form, isProtected: !form.isProtected })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  form.isProtected ? "bg-red-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${
                    form.isProtected ? "translate-x-5" : "translate-x-0"
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
                onClick={handleSave}
                disabled={isSaving}
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : editingId ? "Update Playlist" : "Save Playlist"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
