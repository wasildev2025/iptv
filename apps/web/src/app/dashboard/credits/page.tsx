"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import api from "@/lib/api";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import type { CreditTransaction, CreditPackage, PaginatedResponse, SubReseller } from "@/types";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Coins, ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown,
  SendHorizontal, ChevronLeft, ChevronRight, ShoppingCart,
} from "lucide-react";

const TX_TYPE_CONFIG: Record<string, { label: string; color: "success" | "destructive" | "warning" | "secondary" | "default" }> = {
  purchase: { label: "Purchase", color: "success" },
  activation: { label: "Activation", color: "destructive" },
  renewal: { label: "Renewal", color: "warning" },
  transfer_in: { label: "Received", color: "success" },
  transfer_out: { label: "Sent", color: "destructive" },
  admin_adjustment: { label: "Adjustment", color: "default" },
};

const transferSchema = z.object({
  toUserId: z.string().min(1, "Select a sub-reseller"),
  amount: z.coerce.number().int().min(1, "Min 1 credit").max(100000),
});
type TransferForm = z.infer<typeof transferSchema>;

export default function CreditsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);

  // Balance
  const { data: balance } = useQuery<{ balance: number }>({
    queryKey: ["credits-balance"],
    queryFn: async () => (await api.get("/credits/balance")).data,
  });

  // Packages
  const { data: packages } = useQuery<CreditPackage[]>({
    queryKey: ["credit-packages"],
    queryFn: async () => (await api.get("/credits/packages")).data,
  });

  // History
  const { data: history, isLoading: historyLoading } = useQuery<
    PaginatedResponse<CreditTransaction> & { summary: { netAmount: number; transactionCount: number } }
  >({
    queryKey: ["credit-history", page, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (typeFilter) params.set("type", typeFilter);
      return (await api.get(`/credits/history?${params}`)).data;
    },
  });

  // Sub-resellers (for transfer)
  const { data: resellers } = useQuery<PaginatedResponse<SubReseller>>({
    queryKey: ["resellers-list"],
    queryFn: async () => (await api.get("/resellers?limit=100")).data,
    enabled: user?.role === "admin" || user?.role === "reseller",
  });

  const form = useForm<TransferForm>({
    resolver: zodResolver(transferSchema),
  });

  // Stripe checkout
  const checkoutMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const { data } = await api.post("/payments/checkout", { packageId });
      return data;
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to start checkout"),
  });

  const transferMutation = useMutation({
    mutationFn: (data: TransferForm) => api.post("/credits/transfer", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credits-balance"] });
      queryClient.invalidateQueries({ queryKey: ["credit-history"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setTransferOpen(false);
      form.reset();
      toast.success("Credits transferred successfully");
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Transfer failed"),
  });

  const totalIn = history?.data
    ?.filter((t) => Number(t.amount) > 0)
    .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
  const totalOut = history?.data
    ?.filter((t) => Number(t.amount) < 0)
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Credits</h2>
          <p className="text-muted-foreground">Manage your credit balance and transactions</p>
        </div>
        {(user?.role === "admin" || user?.role === "reseller") && (
          <Button onClick={() => setTransferOpen(true)}>
            <SendHorizontal className="mr-2 h-4 w-4" /> Transfer Credits
          </Button>
        )}
      </div>

      {/* Balance Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <p className="mt-1 text-3xl font-bold">{balance?.balance ?? 0}</p>
              </div>
              <div className="rounded-full bg-primary/10 p-3">
                <Coins className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Credits In (page)</p>
                <p className="mt-1 text-3xl font-bold text-green-600">+{totalIn}</p>
              </div>
              <div className="rounded-full bg-green-100 p-3 dark:bg-green-900">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Credits Out (page)</p>
                <p className="mt-1 text-3xl font-bold text-red-600">-{totalOut}</p>
              </div>
              <div className="rounded-full bg-red-100 p-3 dark:bg-red-900">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Transactions</p>
                <p className="mt-1 text-3xl font-bold">{history?.total ?? 0}</p>
              </div>
              <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900">
                <ShoppingCart className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credit Packages */}
      {packages && packages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Buy Credits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="relative flex flex-col items-center rounded-lg border p-4 text-center hover:border-primary transition-colors"
                >
                  {pkg.bonusCredits > 0 && (
                    <Badge variant="success" className="absolute -top-2 right-2 text-xs">
                      +{pkg.bonusCredits} FREE
                    </Badge>
                  )}
                  <p className="text-3xl font-bold text-primary">{pkg.credits}</p>
                  <p className="text-sm text-muted-foreground">credits</p>
                  {pkg.bonusCredits > 0 && (
                    <p className="text-xs text-green-600 font-medium">
                      Total: {pkg.credits + pkg.bonusCredits} credits
                    </p>
                  )}
                  <div className="mt-3 space-y-1">
                    <p className="text-lg font-semibold">{formatCurrency(Number(pkg.priceUsd))}</p>
                    <p className="text-xs text-muted-foreground">
                      R$ {Number(pkg.priceBrl).toFixed(2)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => checkoutMutation.mutate(pkg.id)}
                    isLoading={checkoutMutation.isPending}
                  >
                    Buy Now
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Transaction History</CardTitle>
            <Select
              className="w-[180px]"
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Types</option>
              <option value="purchase">Purchases</option>
              <option value="activation">Activations</option>
              <option value="renewal">Renewals</option>
              <option value="transfer_in">Received</option>
              <option value="transfer_out">Sent</option>
              <option value="admin_adjustment">Adjustments</option>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {historyLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !history?.data?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Coins className="mb-3 h-10 w-10 opacity-40" />
              <p>No transactions yet</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance After</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.data.map((tx) => {
                    const config = TX_TYPE_CONFIG[tx.type] || { label: tx.type, color: "secondary" as const };
                    const isPositive = Number(tx.amount) > 0;
                    return (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <Badge variant={config.color}>{config.label}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-sm">
                          {tx.description}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          <span className={isPositive ? "text-green-600" : "text-red-600"}>
                            {isPositive ? (
                              <ArrowDownLeft className="mr-1 inline h-3 w-3" />
                            ) : (
                              <ArrowUpRight className="mr-1 inline h-3 w-3" />
                            )}
                            {isPositive ? "+" : ""}{Number(tx.amount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {Number(tx.balanceAfter)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(tx.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {history.totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {history.totalPages} ({history.total} total)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= history.totalPages} onClick={() => setPage(page + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent onClose={() => setTransferOpen(false)}>
          <DialogHeader>
            <DialogTitle>Transfer Credits</DialogTitle>
            <DialogDescription>
              Send credits to one of your sub-resellers
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((data) => transferMutation.mutate(data))}
            className="mt-4 space-y-4"
          >
            <div className="space-y-1.5">
              <Label>Sub-Reseller *</Label>
              <Select
                {...form.register("toUserId")}
                error={form.formState.errors.toUserId?.message}
              >
                <option value="">Select recipient...</option>
                {resellers?.data?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.email}) — {Number(r.creditBalance)} credits
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Amount *</Label>
              <Input
                type="number"
                min={1}
                placeholder="Number of credits"
                error={form.formState.errors.amount?.message}
                {...form.register("amount")}
              />
            </div>

            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Your balance: <span className="font-semibold text-foreground">{balance?.balance ?? 0} credits</span>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTransferOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={transferMutation.isPending}>
                Transfer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
