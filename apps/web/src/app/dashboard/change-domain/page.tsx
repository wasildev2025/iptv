"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import type { App } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Globe, AlertTriangle, Save } from "lucide-react";

export default function ChangeDomainPage() {
  const [selectedApp, setSelectedApp] = useState("");
  const [oldDomain, setOldDomain] = useState("");
  const [newDomain, setNewDomain] = useState("");

  const { data: apps } = useQuery<App[]>({
    queryKey: ["apps"],
    queryFn: async () => (await api.get("/apps")).data,
  });

  const changeDomainMutation = useMutation({
    mutationFn: async () => {
      return api.post("/playlists/change-domain", {
        appId: selectedApp,
        oldDomain,
        newDomain,
      });
    },
    onSuccess: (res) => {
      const count = res.data?.updatedCount ?? 0;
      toast.success(`Domain updated successfully. ${count} playlist(s) affected.`);
      setOldDomain("");
      setNewDomain("");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to change domain");
    },
  });

  const handleSave = () => {
    if (!selectedApp) {
      toast.error("Please select a module");
      return;
    }
    if (!oldDomain.trim()) {
      toast.error("Please enter the old domain");
      return;
    }
    if (!newDomain.trim()) {
      toast.error("Please enter the new domain");
      return;
    }
    if (!oldDomain.startsWith("http://") && !oldDomain.startsWith("https://")) {
      toast.error("Old domain must start with http:// or https://");
      return;
    }
    if (!newDomain.startsWith("http://") && !newDomain.startsWith("https://")) {
      toast.error("New domain must start with http:// or https://");
      return;
    }
    if (!confirm("Are you sure you want to change the domain URL? This will affect all playlists using the old domain.")) {
      return;
    }
    changeDomainMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Change Domain URL</h2>
        <p className="text-muted-foreground">Update playlist domain URLs in bulk</p>
      </div>

      {/* Warning Notice */}
      <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4">
        <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-red-800">PLEASE NOTE</p>
          <p className="text-sm text-red-700">
            This will change the playlist domain name for devices activated by your account ONLY.
            Make sure you have the correct old and new domain URLs before proceeding.
          </p>
        </div>
      </div>

      {/* Change Domain Form */}
      <Card>
        <CardHeader className="bg-red-600 text-white rounded-t-lg py-3 px-4">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Globe className="h-4 w-4" /> Change Domain URL
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
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
            <Label>Old Domain (Including http://) *</Label>
            <Input
              placeholder="http://old-domain.com"
              value={oldDomain}
              onChange={(e) => setOldDomain(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enter the current domain URL that you want to replace
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>New Domain (Including http://) *</Label>
            <Input
              placeholder="http://new-domain.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enter the new domain URL that will replace the old one
            </p>
          </div>

          <div className="pt-2">
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleSave}
              disabled={changeDomainMutation.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              {changeDomainMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
