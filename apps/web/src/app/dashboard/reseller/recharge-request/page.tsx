"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  CreditCard, CheckCircle, XCircle, Clock, Inbox,
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

export default function RechargeRequestPage() {
  const queryClient = useQueryClient();
  const [requestTo, setRequestTo] = useState("parent");
  const [targetEmail, setTargetEmail] = useState("");
  const [amount, setAmount] = useState("");

  // Pending requests that need YOUR approval
  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ["recharge-requests-pending"],
    queryFn: async () => (await api.get("/recharge-requests/pending")).data,
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      const payload: any = { requested_amount: Number(amount) };
      if (requestTo === "parent") {
        payload.request_from_parent = true;
      } else {
        payload.target_email = targetEmail;
      }
      return api.post("/recharge-requests", payload);
    },
    onSuccess: () => {
      toast.success("Recharge request sent successfully");
      setAmount("");
      setTargetEmail("");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || "Failed to send request"),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/recharge-requests/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recharge-requests-pending"] });
      toast.success("Request approved");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || "Failed to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/recharge-requests/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recharge-requests-pending"] });
      toast.success("Request rejected");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || "Failed to reject"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Recharge Request</h2>
        <p className="text-muted-foreground">
          Request credits from your parent reseller or a specific reseller
        </p>
      </div>

      {/* Submit Request Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5 text-red-600" />
            Send Recharge Request
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!amount || Number(amount) <= 0) {
                toast.error("Please enter a valid credit amount");
                return;
              }
              if (requestTo === "specific" && !targetEmail.trim()) {
                toast.error("Please enter the reseller email");
                return;
              }
              submitMutation.mutate();
            }}
            className="space-y-4 max-w-md"
          >
            <div className="space-y-1.5">
              <Label>Request To *</Label>
              <Select
                value={requestTo}
                onChange={(e) => setRequestTo(e.target.value)}
              >
                <option value="parent">My Parent Reseller</option>
                <option value="specific">Specific Reseller</option>
              </Select>
            </div>

            {requestTo === "specific" && (
              <div className="space-y-1.5">
                <Label>Reseller Email *</Label>
                <Input
                  type="email"
                  placeholder="Enter the reseller's email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Credit Amount Needed *</Label>
              <Input
                type="number"
                min={1}
                placeholder="Enter credit amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              className="bg-red-600 hover:bg-red-700"
              isLoading={submitMutation.isPending}
            >
              Send Request to Parent
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Pending Requests Needing Your Approval */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Inbox className="h-5 w-5 text-red-600" />
            Pending Requests (Awaiting Your Approval)
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
              <p className="text-sm">No pending recharge requests</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Requested</TableHead>
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
                    <TableCell className="text-right font-mono font-medium">
                      {req.requested_amount || req.requestedAmount || req.amount}
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
    </div>
  );
}
