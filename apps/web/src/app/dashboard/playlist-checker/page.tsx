"use client";

import { useState } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

type CheckResult = {
  status: "ok" | "reachable" | "unknown" | "error";
  host?: string | null;
  username?: string | null;
  accountStatus?: string | null;
  isActive?: boolean | null;
  isExpired?: boolean | null;
  isTrial?: boolean | null;
  expiresAt?: string | null;
  createdAt?: string | null;
  maxConnections?: number | null;
  activeConnections?: number | null;
  serverInfo?: {
    url?: string | null;
    port?: string | null;
    httpsPort?: string | null;
    timezone?: string | null;
    timeNow?: string | null;
  } | null;
  message?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function PlaylistCheckerPage() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    if (!url) return;
    setLoading(true);
    setResult(null);

    try {
      const { data } = await api.post<CheckResult>("/public/check-playlist", {
        url: url.trim(),
      });
      setResult(data);
    } catch (err: any) {
      setResult({
        status: "error",
        message:
          err?.response?.data?.message ||
          "Could not reach the URL. The server may be down or the URL is invalid.",
      });
    } finally {
      setLoading(false);
    }
  };

  const isOk = result?.status === "ok";
  const isReachable = result?.status === "reachable";
  const isError = result?.status === "error";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 text-red-600">
          <CheckCircle className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold">Free IPTV Status Checker</h1>
        <p className="mt-2 text-muted-foreground">
          Check your IPTV account status, expiration date, and connection limits
          in seconds. Secure, fast, and completely free IPTV verification tool.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">IPTV URL</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="http://yourdns/get.php?username=username&password=password&type=m3u_plus&output=mpegts"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Enter your IPTV URL with username and password parameters
          </p>
          <Button
            onClick={handleCheck}
            className="w-full bg-red-600 hover:bg-red-700"
            disabled={loading || !url}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            Check Status
          </Button>
        </CardContent>
      </Card>

      {result && isOk && (
        <Card
          className={
            result.isActive === false ? "border-amber-500" : "border-green-500"
          }
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle
                className={`h-5 w-5 ${
                  result.isActive === false ? "text-amber-500" : "text-green-500"
                }`}
              />
              <CardTitle className="text-base">
                {result.isActive === false
                  ? result.isExpired
                    ? "Account Expired"
                    : "Account Inactive"
                  : "Account Active"}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Username</dt>
                <dd className="font-medium break-all">
                  {result.username || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Server</dt>
                <dd className="font-medium break-all">{result.host || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium capitalize">
                  {result.accountStatus || "—"}
                  {result.isTrial ? " (Trial)" : ""}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Expires</dt>
                <dd className="font-medium">{formatDate(result.expiresAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="font-medium">{formatDate(result.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Connections</dt>
                <dd className="font-medium">
                  {result.activeConnections ?? 0}
                  {result.maxConnections ? ` / ${result.maxConnections}` : ""}
                </dd>
              </div>
              {result.serverInfo?.timezone && (
                <div>
                  <dt className="text-muted-foreground">Server Timezone</dt>
                  <dd className="font-medium">{result.serverInfo.timezone}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      {result && isReachable && (
        <Card className="border-green-500">
          <CardContent className="flex items-start gap-3 py-4">
            <CheckCircle className="mt-0.5 h-5 w-5 text-green-500" />
            <div>
              <p className="font-medium">URL Reachable</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.message}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {result && isError && (
        <Card className="border-red-500">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-500" />
            <div>
              <p className="font-medium">Check Failed</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.message}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {result && result.status === "unknown" && (
        <Card className="border-amber-500">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-500" />
            <div>
              <p className="font-medium">Unexpected Response</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.message}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            We've designed this tool to be simple, fast, and secure. Your IPTV URL
            is never stored or shared with third parties. This checker helps you
            verify your IPTV subscription status, expiration dates, and account
            details in real-time without compromising your privacy or security.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="font-medium">Is my IPTV URL safe?</p>
            <p className="text-muted-foreground">Yes, your IPTV URL is processed securely and is never stored on our servers or shared with third parties.</p>
          </div>
          <div>
            <p className="font-medium">What information can I check?</p>
            <p className="text-muted-foreground">You can check your account status, subscription expiration date, connection limits, and server information.</p>
          </div>
          <div>
            <p className="font-medium">Why is my check failing?</p>
            <p className="text-muted-foreground">Make sure your IPTV URL is correct and includes the username and password parameters. The server must also be online and accessible.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
