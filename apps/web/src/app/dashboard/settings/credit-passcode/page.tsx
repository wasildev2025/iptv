"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Lock } from "lucide-react";

const setPasscodeSchema = z
  .object({
    password: z
      .string()
      .min(4, "Passcode must be at least 4 characters")
      .max(32, "Passcode must be at most 32 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const updatePasscodeSchema = z
  .object({
    oldPassword: z.string().min(1, "Old password is required"),
    newPassword: z
      .string()
      .min(4, "Passcode must be at least 4 characters")
      .max(32, "Passcode must be at most 32 characters"),
    confirmNewPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

type SetPasscodeForm = z.infer<typeof setPasscodeSchema>;
type UpdatePasscodeForm = z.infer<typeof updatePasscodeSchema>;

export default function CreditPasscodePage() {
  const queryClient = useQueryClient();

  const { data: passcodeStatus, isLoading } = useQuery<{ hasPasscode: boolean }>({
    queryKey: ["credit-passcode-status"],
    queryFn: async () => (await api.get("/credit-passcode/status")).data,
  });

  const hasPasscode = passcodeStatus?.hasPasscode ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Credit Share Password</h2>
        <p className="text-muted-foreground">
          {hasPasscode
            ? "Update your credit share passcode for secure transfers"
            : "Set a passcode to secure your credit share transactions"}
        </p>
      </div>

      <div className="max-w-lg">
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
              <p>Loading...</p>
            </CardContent>
          </Card>
        ) : hasPasscode ? (
          <UpdatePasscodeCard
            onSuccess={() =>
              queryClient.invalidateQueries({ queryKey: ["credit-passcode-status"] })
            }
          />
        ) : (
          <SetPasscodeCard
            onSuccess={() =>
              queryClient.invalidateQueries({ queryKey: ["credit-passcode-status"] })
            }
          />
        )}
      </div>
    </div>
  );
}

function SetPasscodeCard({ onSuccess }: { onSuccess: () => void }) {
  const form = useForm<SetPasscodeForm>({
    resolver: zodResolver(setPasscodeSchema),
  });

  const mutation = useMutation({
    mutationFn: async (data: SetPasscodeForm) => {
      await api.post("/credit-passcode/set", { password: data.password });
    },
    onSuccess: () => {
      toast.success("Credit share passcode set successfully");
      form.reset();
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to set passcode");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-red-600" />
          Set Credit Share Password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              placeholder="Enter your passcode"
              error={form.formState.errors.password?.message}
              {...form.register("password")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm Password</Label>
            <Input
              type="password"
              placeholder="Confirm your passcode"
              error={form.formState.errors.confirmPassword?.message}
              {...form.register("confirmPassword")}
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white"
            isLoading={mutation.isPending}
          >
            <Lock className="mr-2 h-4 w-4" />
            Update
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function UpdatePasscodeCard({ onSuccess }: { onSuccess: () => void }) {
  const form = useForm<UpdatePasscodeForm>({
    resolver: zodResolver(updatePasscodeSchema),
  });

  const mutation = useMutation({
    mutationFn: async (data: UpdatePasscodeForm) => {
      await api.post("/credit-passcode/update", {
        oldPassword: data.oldPassword,
        newPassword: data.newPassword,
      });
    },
    onSuccess: () => {
      toast.success("Credit share passcode updated successfully");
      form.reset();
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to update passcode");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-red-600" />
          Update Credit Share Password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label>Old Password</Label>
            <Input
              type="password"
              placeholder="Enter current passcode"
              error={form.formState.errors.oldPassword?.message}
              {...form.register("oldPassword")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <Input
              type="password"
              placeholder="Enter new passcode"
              error={form.formState.errors.newPassword?.message}
              {...form.register("newPassword")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm New Password</Label>
            <Input
              type="password"
              placeholder="Confirm new passcode"
              error={form.formState.errors.confirmNewPassword?.message}
              {...form.register("confirmNewPassword")}
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white"
            isLoading={mutation.isPending}
          >
            <Lock className="mr-2 h-4 w-4" />
            Update
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
