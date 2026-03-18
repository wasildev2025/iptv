"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRightLeft, ClipboardList } from "lucide-react";

export default function ChangeResellerPage() {
  const [newParentEmail, setNewParentEmail] = useState("");

  const submitMutation = useMutation({
    mutationFn: () =>
      api.post("/parent-change/request", { new_parent_email: newParentEmail }),
    onSuccess: () => {
      toast.success("Parent change request submitted successfully");
      setNewParentEmail("");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || "Failed to submit request"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Change Reseller</h2>
          <p className="text-muted-foreground">
            Request to change your parent reseller
          </p>
        </div>
        <Link href="/dashboard/reseller/parent-change-requests">
          <Button variant="outline">
            <ClipboardList className="mr-2 h-4 w-4" /> My Change Requests
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ArrowRightLeft className="h-5 w-5 text-red-600" />
            Submit Parent Change Request
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newParentEmail.trim()) {
                toast.error("Please enter the new parent reseller email");
                return;
              }
              submitMutation.mutate();
            }}
            className="space-y-4 max-w-md"
          >
            <div className="space-y-1.5">
              <Label>New Parent Reseller Email *</Label>
              <Input
                type="email"
                placeholder="Enter the email of the new parent reseller"
                value={newParentEmail}
                onChange={(e) => setNewParentEmail(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                The new parent reseller will need to approve this request
              </p>
            </div>
            <Button
              type="submit"
              className="bg-red-600 hover:bg-red-700"
              isLoading={submitMutation.isPending}
            >
              Submit Request
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
