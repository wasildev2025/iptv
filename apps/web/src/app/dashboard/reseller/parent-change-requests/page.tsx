"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Search, CheckCircle, XCircle, Clock, Send, Inbox,
} from "lucide-react";

function statusBadge(status: string) {
  switch (status) {
    case "pending":
      return <Badge variant="warning">Pending</Badge>;
    case "approved":
      return <Badge variant="success">Approved</Badge>;
    case "rejected":
      return <Badge variant="destructive">Rejected</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function ParentChangeRequestsPage() {
  const queryClient = useQueryClient();
  const [historySearch, setHistorySearch] = useState("");
  const [historySearchInput, setHistorySearchInput] = useState("");

  // Pending requests awaiting current user's approval
  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ["parent-change-pending"],
    queryFn: async () => (await api.get("/parent-change/pending")).data,
  });

  // Request history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["parent-change-history", historySearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (historySearch) params.set("search", historySearch);
      return (await api.get(`/parent-change/history?${params}`)).data;
    },
  });

  // My own change requests
  const { data: myData, isLoading: myLoading } = useQuery({
    queryKey: ["parent-change-my"],
    queryFn: async () => (await api.get("/parent-change/my")).data,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/parent-change/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parent-change-pending"] });
      queryClient.invalidateQueries({ queryKey: ["parent-change-history"] });
      toast.success("Request approved");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || "Failed to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/parent-change/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parent-change-pending"] });
      queryClient.invalidateQueries({ queryKey: ["parent-change-history"] });
      toast.success("Request rejected");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || "Failed to reject"),
  });

  const handleHistorySearch = () => {
    setHistorySearch(historySearchInput);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Parent Change Requests</h2>
        <p className="text-muted-foreground">
          Manage parent reseller change requests
        </p>
      </div>

      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Inbox className="h-5 w-5 text-red-600" />
            Pending Requests
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pendingLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !pendingData?.length ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Clock className="mb-3 h-10 w-10 opacity-40" />
              <p className="text-sm">No pending requests</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requester</TableHead>
                  <TableHead>Requester Email</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingData.map((req: any) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">
                      {req.requester_name || req.requester?.name || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {req.requester_email || req.requester?.email || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(req.created_at || req.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => approveMutation.mutate(req.id)}
                          isLoading={approveMutation.isPending}
                        >
                          <CheckCircle className="mr-1 h-3 w-3" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => rejectMutation.mutate(req.id)}
                          isLoading={rejectMutation.isPending}
                        >
                          <XCircle className="mr-1 h-3 w-3" /> Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Request History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-red-600" />
            Request History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 max-w-md">
            <Input
              placeholder="Search by name or email..."
              value={historySearchInput}
              onChange={(e) => setHistorySearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleHistorySearch()}
            />
            <Button variant="outline" size="icon" onClick={handleHistorySearch}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
        <CardContent className="p-0 pt-0">
          {historyLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !historyData?.length ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <p className="text-sm">No history found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requester</TableHead>
                  <TableHead>New Parent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Resolved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyData.map((req: any) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">
                      {req.requester_name || req.requester?.name || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {req.new_parent_email || req.newParentEmail || "-"}
                    </TableCell>
                    <TableCell>{statusBadge(req.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(req.created_at || req.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {req.resolved_at || req.resolvedAt
                        ? formatDate(req.resolved_at || req.resolvedAt)
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* My Change Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Send className="h-5 w-5 text-red-600" />
            My Change Requests
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {myLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !myData?.length ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <p className="text-sm">You haven&apos;t submitted any requests</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requested Parent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myData.map((req: any) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">
                      {req.new_parent_email || req.newParentEmail || "-"}
                    </TableCell>
                    <TableCell>{statusBadge(req.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(req.created_at || req.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
