"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { ActivityLog, CreditTransaction, PaginatedResponse } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  ScrollText, Coins, LogIn, ChevronLeft, ChevronRight, Download,
} from "lucide-react";

interface LoginLog {
  id: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  createdAt: string;
}

const ACTION_COLORS: Record<string, "success" | "destructive" | "warning" | "default" | "secondary"> = {
  "device.activate": "success",
  "device.renew": "default",
  "device.disable": "warning",
  "device.enable": "success",
  "device.delete": "destructive",
  "credits.transfer": "default",
  "credits.admin_adjust": "secondary",
  "reseller.create": "success",
  "reseller.update": "default",
  "reseller.delete": "destructive",
};

function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t px-4 py-3">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages} ({total} total)
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

// ─── CSV Export Helper ──────────────────────────────────────────

async function downloadCsv(endpoint: string, filename: string) {
  try {
    const response = await api.get(endpoint, { responseType: "blob" });
    const blob = new Blob([response.data], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch {
    // silently fail or could show toast
  }
}

// ─── Activity Logs Tab ──────────────────────────────────────────

function ActivityLogsTab() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<PaginatedResponse<ActivityLog>>({
    queryKey: ["activity-logs", page],
    queryFn: async () =>
      (await api.get(`/logs/activity?page=${page}&limit=20`)).data,
  });

  return (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <LoadingSkeleton />
        ) : !data?.data?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ScrollText className="mb-3 h-10 w-10 opacity-40" />
            <p>No activity logs yet</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant={ACTION_COLORS[log.action] || "secondary"}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[400px]">
                      <div className="text-sm text-muted-foreground">
                        {formatDetails(log.details)}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {log.ipAddress || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(log.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Credit Logs Tab ────────────────────────────────────────────

function CreditLogsTab() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<PaginatedResponse<CreditTransaction>>({
    queryKey: ["credit-logs", page],
    queryFn: async () =>
      (await api.get(`/logs/credits?page=${page}&limit=20`)).data,
  });

  return (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <LoadingSkeleton />
        ) : !data?.data?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Coins className="mb-3 h-10 w-10 opacity-40" />
            <p>No credit transactions yet</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((tx) => {
                  const isPositive = Number(tx.amount) > 0;
                  return (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <Badge variant={isPositive ? "success" : "destructive"}>
                          {tx.type.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm">
                        {tx.description}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        <span className={isPositive ? "text-green-600" : "text-red-600"}>
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
            <Pagination page={page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Login Logs Tab ─────────────────────────────────────────────

function LoginLogsTab() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<PaginatedResponse<LoginLog>>({
    queryKey: ["login-logs", page],
    queryFn: async () =>
      (await api.get(`/logs/logins?page=${page}&limit=20`)).data,
  });

  return (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <LoadingSkeleton />
        ) : !data?.data?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <LogIn className="mb-3 h-10 w-10 opacity-40" />
            <p>No login logs yet</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>User Agent</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant={log.success ? "success" : "destructive"}>
                        {log.success ? "Success" : "Failed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{log.ipAddress}</TableCell>
                    <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                      {log.userAgent || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(log.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Helper ─────────────────────────────────────────────────────

function formatDetails(details: Record<string, unknown>): string {
  if (!details || typeof details !== "object") return "—";
  const parts: string[] = [];
  if (details.appName) parts.push(String(details.appName));
  if (details.macAddress) parts.push(String(details.macAddress));
  if (details.packageType) parts.push(String(details.packageType));
  if (details.amount) parts.push(`${details.amount} credits`);
  if (details.toUserName) parts.push(`→ ${details.toUserName}`);
  if (details.targetUserName) parts.push(String(details.targetUserName));
  if (details.reason) parts.push(String(details.reason));
  return parts.length ? parts.join(" · ") : JSON.stringify(details).slice(0, 100);
}

// ─── Main Page ──────────────────────────────────────────────────

export default function LogsPage() {
  const [tab, setTab] = useState("activity");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Logs</h2>
        <p className="text-muted-foreground">View your activity history and audit trail</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="activity">
              <ScrollText className="mr-2 h-4 w-4" /> Activity
            </TabsTrigger>
            <TabsTrigger value="credits">
              <Coins className="mr-2 h-4 w-4" /> Credits
            </TabsTrigger>
            <TabsTrigger value="logins">
              <LogIn className="mr-2 h-4 w-4" /> Logins
            </TabsTrigger>
          </TabsList>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const exportMap: Record<string, { endpoint: string; filename: string }> = {
                activity: { endpoint: "/logs/export/activity", filename: "activity-logs.csv" },
                credits: { endpoint: "/logs/export/credits", filename: "credit-logs.csv" },
                logins: { endpoint: "/logs/export/logins", filename: "login-logs.csv" },
              };
              const config = exportMap[tab];
              if (config) downloadCsv(config.endpoint, config.filename);
            }}
          >
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>

        <TabsContent value="activity">
          <ActivityLogsTab />
        </TabsContent>
        <TabsContent value="credits">
          <CreditLogsTab />
        </TabsContent>
        <TabsContent value="logins">
          <LoginLogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
