"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Coins, ShoppingCart } from "lucide-react";

interface PaymentPackage {
  id: string;
  title: string;
  description: string;
  priceEur: number;
  priceUsd: number;
  credits: number;
  bonusCredits: number;
  isActive: boolean;
}

export default function PaymentPlansPage() {
  const { data: packages, isLoading } = useQuery<PaymentPackage[]>({
    queryKey: ["payment-packages"],
    queryFn: async () => {
      const res = await api.get("/credits/packages");
      return res.data;
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const { data } = await api.post("/payments/create-session", { packageId });
      return data;
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to start checkout");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Payment Plans</h2>
        <p className="text-muted-foreground">
          Purchase credit packages to activate and manage devices
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-32 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-10 w-24 mb-4" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !packages?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ShoppingCart className="mb-3 h-10 w-10 opacity-40" />
            <p>No payment plans available at the moment</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <Card
              key={pkg.id}
              className="relative overflow-hidden border-2 transition-colors hover:border-red-500"
            >
              {pkg.bonusCredits > 0 && (
                <Badge
                  variant="success"
                  className="absolute right-3 top-3 text-xs"
                >
                  +{pkg.bonusCredits} BONUS
                </Badge>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  {pkg.title || `${pkg.credits} Credits`}
                </CardTitle>
                {pkg.description && (
                  <p className="text-sm text-muted-foreground">
                    {pkg.description}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-red-600">
                    &euro;{Number(pkg.priceEur || pkg.priceUsd || 0).toFixed(2)}
                  </span>
                  <span className="text-sm text-muted-foreground">EUR</span>
                </div>

                <div className="flex items-center gap-2 rounded-md bg-muted p-3">
                  <Coins className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="text-sm font-semibold">
                      {pkg.credits} Credit Points
                    </p>
                    {pkg.bonusCredits > 0 && (
                      <p className="text-xs text-green-600">
                        Total: {pkg.credits + pkg.bonusCredits} credits
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => checkoutMutation.mutate(pkg.id)}
                  isLoading={checkoutMutation.isPending}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Purchase Package
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
