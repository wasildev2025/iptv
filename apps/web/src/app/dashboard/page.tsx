"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { DashboardStats, Announcement } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Monitor, CheckCircle, XCircle, Coins, Users, Zap, Download } from "lucide-react";
import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

function StatsCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-1 text-3xl font-bold">{value}</p>
          </div>
          <div className={`rounded-full p-3 ${color}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const CREDIT_TYPE_COLORS: Record<string, string> = {
  purchase: "#22c55e",
  activation: "#ef4444",
  renewal: "#f59e0b",
  transfer_in: "#3b82f6",
  transfer_out: "#8b5cf6",
  admin_adjustment: "#6b7280",
};

interface AppActivation {
  app_name: string;
  count: number;
}

interface DeviceTrend {
  date: string;
  activations: number;
}

interface CreditUsageEntry {
  type: string;
  total: number;
}

const APP_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16"];

export default function DashboardPage() {
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => (await api.get("/dashboard/stats")).data,
  });

  const { data: announcements } = useQuery<Announcement[]>({
    queryKey: ["announcements"],
    queryFn: async () => (await api.get("/dashboard/announcements")).data,
  });

  const { data: appActivations } = useQuery<AppActivation[]>({
    queryKey: ["activation-log"],
    queryFn: async () => (await api.get("/dashboard/activation-log")).data,
  });

  const handleDownloadReport = async () => {
    try {
      const response = await api.get(`/logs/export/credits-range?start_date=${startDate}&end_date=${endDate}`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `credit-report-${startDate}-${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert("An error occurred while downloading");
    }
  };

  const { data: deviceTrends, isLoading: trendsLoading } = useQuery<DeviceTrend[]>({
    queryKey: ["device-trends"],
    queryFn: async () => (await api.get("/dashboard/device-trends")).data,
  });

  const { data: creditUsage, isLoading: creditLoading } = useQuery<CreditUsageEntry[]>({
    queryKey: ["credit-usage"],
    queryFn: async () => (await api.get("/dashboard/credit-usage")).data,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground">
          Overview of your reseller account
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatsCard
          title="Total Devices"
          value={stats?.totalDevices ?? 0}
          icon={Monitor}
          color="bg-blue-500"
        />
        <StatsCard
          title="Active"
          value={stats?.activeDevices ?? 0}
          icon={CheckCircle}
          color="bg-green-500"
        />
        <StatsCard
          title="Expired"
          value={stats?.expiredDevices ?? 0}
          icon={XCircle}
          color="bg-red-500"
        />
        <StatsCard
          title="Credits"
          value={stats?.creditBalance ?? 0}
          icon={Coins}
          color="bg-yellow-500"
        />
        <StatsCard
          title="Recent Activations"
          value={stats?.recentActivations ?? 0}
          icon={Zap}
          color="bg-purple-500"
        />
        <StatsCard
          title="Sub-Resellers"
          value={stats?.totalSubResellers ?? 0}
          icon={Users}
          color="bg-indigo-500"
        />
      </div>

      {/* IBOSOL-style row: Credit Report + Total Resellers + Total Credit Share */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">
              Download Reseller Credit Share Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <Button
              onClick={handleDownloadReport}
              size="sm"
              className="bg-red-600 hover:bg-red-700"
            >
              <Download className="mr-1 h-4 w-4" /> Download
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">Total Resellers</p>
            <p className="mt-2 text-4xl font-bold text-red-600">
              {stats?.totalSubResellers ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">
              Total Credit Share
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-4xl font-bold">{stats?.creditBalance ?? 0}</p>
            <p className="text-xs text-muted-foreground">Total Credit Points</p>
          </CardContent>
        </Card>
      </div>

      {/* App Wise Activation in Last Month */}
      {appActivations && appActivations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-red-600">
              App Wise - Total Activation In The Last Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={appActivations}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="count"
                  nameKey="app_name"
                  label={({ app_name, count }: any) => `${app_name}: ${count}`}
                >
                  {appActivations.map((entry, idx) => (
                    <Cell key={entry.app_name} fill={APP_COLORS[idx % APP_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Announcements */}
      {announcements && announcements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Announcements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {announcements.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                <Badge variant="default" className="mt-0.5">
                  New
                </Badge>
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-sm text-muted-foreground">{a.body}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Device Activation Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Device Activation Trends</CardTitle>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : !deviceTrends || deviceTrends.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No activation data for the last 30 days
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={deviceTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value: string) =>
                      new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                    fontSize={12}
                  />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip
                    labelFormatter={(value: string) =>
                      new Date(value).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="activations"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Credit Usage by Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Credit Usage by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {creditLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : !creditUsage || creditUsage.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                No credit transactions for the last 30 days
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={creditUsage}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="total"
                    nameKey="type"
                    label={({ type, total }: { type: string; total: number }) =>
                      `${type.replace(/_/g, " ")}: ${total.toFixed(1)}`
                    }
                  >
                    {creditUsage.map((entry) => (
                      <Cell
                        key={entry.type}
                        fill={CREDIT_TYPE_COLORS[entry.type] ?? "#94a3b8"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => value.toFixed(2)}
                  />
                  <Legend
                    formatter={(value: string) => value.replace(/_/g, " ")}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
