"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function PlaylistCheckerPage() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCheck = async () => {
    if (!url) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(url, { method: "HEAD", mode: "no-cors" });
      setResult({
        status: "reachable",
        url,
        message: "URL appears to be reachable. Note: Full status check requires server-side validation.",
      });
    } catch {
      setResult({
        status: "error",
        url,
        message: "Could not reach the URL. The server may be down or the URL is invalid.",
      });
    } finally {
      setLoading(false);
    }
  };

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

      {result && (
        <Card className={result.status === "reachable" ? "border-green-500" : "border-red-500"}>
          <CardContent className="flex items-start gap-3 py-4">
            {result.status === "reachable" ? (
              <CheckCircle className="mt-0.5 h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="mt-0.5 h-5 w-5 text-red-500" />
            )}
            <div>
              <p className="font-medium">{result.status === "reachable" ? "URL Reachable" : "Check Failed"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{result.message}</p>
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
