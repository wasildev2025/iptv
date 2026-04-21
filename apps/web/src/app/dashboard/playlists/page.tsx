"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
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
  CheckCircle2,
  Loader2,
  Smartphone,
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

interface DeviceRow {
  id: string;
  macAddress: string;
  macAddressAlt: string | null;
  status: "active" | "expired" | "disabled" | "trial";
  packageType: "yearly" | "lifetime";
  expiresAt: string | null;
  playlistUrl: string | null;
  notes: string | null;
  createdAt: string;
  app: { id: string; name: string; slug: string };
}

interface DevicesPage {
  data: DeviceRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const DEVICES_PAGE_SIZE = 50;

export default function PlaylistsPage() {
  const [selectedApp, setSelectedApp] = useState("");
  const [macAddress, setMacAddress] = useState("");
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [debouncedDeviceSearch, setDebouncedDeviceSearch] = useState("");

  const [form, setForm] = useState<PlaylistFormState>(emptyForm);

  const { data: apps } = useQuery<App[]>({
    queryKey: ["apps"],
    queryFn: async () => (await api.get("/apps")).data,
  });

  // Debounce the device search so we don't hammer the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedDeviceSearch(deviceSearch.trim()), 250);
    return () => clearTimeout(t);
  }, [deviceSearch]);

  const devicesQuery = useQuery<DevicesPage>({
    queryKey: ["playlists-page-devices", selectedApp, debouncedDeviceSearch],
    enabled: !!selectedApp,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({
        appId: selectedApp,
        limit: String(DEVICES_PAGE_SIZE),
      });
      if (debouncedDeviceSearch) params.set("search", debouncedDeviceSearch);
      const res = await api.get(`/devices?${params.toString()}`);
      return res.data as DevicesPage;
    },
  });

  const checkStatusMutation = useMutation<
    DeviceStatus,
    Error,
    { macAddress?: string } | void
  >({
    mutationFn: async (override) => {
      const mac = override?.macAddress ?? macAddress;
      const res = await api.post("/playlists/check-status", {
        appId: selectedApp,
        macAddress: mac,
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

  /** Fill the MAC input from the device list and immediately run Check Status. */
  const handlePickDevice = (device: DeviceRow) => {
    setMacAddress(device.macAddress);
    setDeviceStatus(null);
    resetForm();
    // Pass the MAC directly so we don't race the async setState flush.
    checkStatusMutation.mutate({ macAddress: device.macAddress });
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
                  setDeviceSearch("");
                  setMacAddress("");
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

      {selectedApp && (
        <DevicesForAppCard
          isLoading={devicesQuery.isLoading}
          isFetching={devicesQuery.isFetching}
          devices={devicesQuery.data?.data ?? []}
          total={devicesQuery.data?.total ?? 0}
          search={deviceSearch}
          onSearchChange={setDeviceSearch}
          activeMac={macAddress}
          onPick={handlePickDevice}
        />
      )}

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

// ----------------------------------------------------------------------------
// Device picker — lists the reseller's devices for the selected app. Clicking
// a row fills the MAC input above and triggers Check Status.
// ----------------------------------------------------------------------------

function DevicesForAppCard(props: {
  isLoading: boolean;
  isFetching: boolean;
  devices: DeviceRow[];
  total: number;
  search: string;
  onSearchChange: (v: string) => void;
  activeMac: string;
  onPick: (d: DeviceRow) => void;
}) {
  const {
    isLoading,
    isFetching,
    devices,
    total,
    search,
    onSearchChange,
    activeMac,
    onPick,
  } = props;

  return (
    <Card>
      <CardHeader className="bg-gray-100 py-3 px-4 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          My Devices for this App
          {total > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              ({devices.length} of {total} shown)
            </span>
          )}
        </CardTitle>
        <div className="relative w-64 max-w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search MAC or notes..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading devices...
          </div>
        ) : devices.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground italic">
            {search
              ? "No devices match your search."
              : "No devices activated for this app yet. Activate a device first, then come back here to attach a playlist."}
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {isFetching && (
              <div className="sticky top-0 bg-white/90 backdrop-blur-sm border-b px-3 py-1 text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Refreshing...
              </div>
            )}
            <ul className="divide-y">
              {devices.map((d) => {
                const isActive = activeMac === d.macAddress;
                const isExpired = d.status === "expired" || d.status === "disabled";
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => onPick(d)}
                      disabled={isExpired}
                      className={`w-full text-left px-4 py-3 grid grid-cols-[1fr_auto] gap-3 items-center transition-colors ${
                        isActive ? "bg-red-50" : "hover:bg-gray-50"
                      } ${isExpired ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-medium text-sm">
                            {d.macAddress}
                          </span>
                          <StatusBadge status={d.status} />
                          {d.playlistUrl && (
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5">
                              <CheckCircle2 className="h-3 w-3" /> Has playlist
                            </span>
                          )}
                          {d.packageType === "lifetime" && (
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-gray-100 rounded px-1.5 py-0.5">
                              Lifetime
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground flex flex-wrap gap-x-3">
                          <span>
                            Expires:{" "}
                            {d.expiresAt
                              ? new Date(d.expiresAt).toLocaleDateString()
                              : "—"}
                          </span>
                          {d.macAddressAlt && (
                            <span>Alt: {d.macAddressAlt}</span>
                          )}
                          {d.notes && (
                            <span className="truncate max-w-[280px]">
                              {d.notes}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-red-600 font-medium shrink-0">
                        {isActive ? "Selected" : "Use →"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: DeviceRow["status"] }) {
  const tone: Record<DeviceRow["status"], string> = {
    active: "text-green-700 bg-green-50",
    trial: "text-blue-700 bg-blue-50",
    expired: "text-red-700 bg-red-50",
    disabled: "text-gray-700 bg-gray-100",
  };
  return (
    <span
      className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 ${tone[status]}`}
    >
      {status}
    </span>
  );
}
