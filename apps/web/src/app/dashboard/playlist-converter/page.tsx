"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shuffle, Copy, Check, Search } from "lucide-react";

type Mode = "create" | "parse";

export default function PlaylistConverterPage() {
  const [mode, setMode] = useState<Mode>("create");
  const [hostname, setHostname] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [parseUrl, setParseUrl] = useState("");
  const [result, setResult] = useState("");
  const [parsed, setParsed] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = () => {
    if (!hostname) return;
    const host = hostname.startsWith("http") ? hostname : `http://${hostname}`;
    const base = host.replace(/\/$/, "");
    const url = `${base}/get.php?username=${username}&password=${password}&type=m3u_plus&output=mpegts`;
    setResult(url);
  };

  const handleParse = () => {
    if (!parseUrl) return;
    try {
      const url = new URL(parseUrl);
      setParsed({
        hostname: url.origin,
        username: url.searchParams.get("username") || "",
        password: url.searchParams.get("password") || "",
        type: url.searchParams.get("type") || "",
        output: url.searchParams.get("output") || "",
      });
    } catch {
      setParsed({ error: "Invalid URL format" });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setHostname("");
    setUsername("");
    setPassword("");
    setParseUrl("");
    setResult("");
    setParsed(null);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 text-red-600">
          <Shuffle className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold">M3U URL Converter</h1>
        <p className="mt-2 text-muted-foreground">
          Convert your IPTV credentials to M3U playlist URLs or parse existing URLs
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-lg border">
        <button
          onClick={() => { setMode("create"); setResult(""); setParsed(null); }}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            mode === "create"
              ? "bg-red-600 text-white rounded-l-lg"
              : "hover:bg-muted"
          }`}
        >
          + Create URL
        </button>
        <button
          onClick={() => { setMode("parse"); setResult(""); setParsed(null); }}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            mode === "parse"
              ? "bg-red-600 text-white rounded-r-lg"
              : "hover:bg-muted"
          }`}
        >
          <Search className="mr-1 inline h-4 w-4" /> Parse URL
        </button>
      </div>

      {mode === "create" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">+ Create M3U URL</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter your IPTV service details to generate a M3U playlist URL.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Hostname *</label>
              <Input
                placeholder="Your Hostname"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">Include http:// prefix</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Username</label>
                <Input
                  placeholder="Your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Password</label>
                <Input
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} className="flex-1 bg-red-600 hover:bg-red-700">
                Convert to M3U URL
              </Button>
              <Button onClick={handleClear} variant="outline">
                Clear
              </Button>
            </div>

            {result && (
              <div className="mt-4 rounded-lg border bg-muted/50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Generated URL:</p>
                  <button onClick={handleCopy} className="text-xs text-primary hover:underline flex items-center gap-1">
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <p className="mt-1 break-all text-sm font-mono">{result}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parse Existing M3U URL</CardTitle>
            <p className="text-sm text-muted-foreground">
              Paste an M3U URL to extract hostname, username, and password.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Paste your M3U URL here..."
              value={parseUrl}
              onChange={(e) => setParseUrl(e.target.value)}
            />
            <Button onClick={handleParse} className="w-full bg-red-600 hover:bg-red-700">
              Parse URL
            </Button>

            {parsed && !parsed.error && (
              <div className="space-y-2 rounded-lg border p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Hostname:</span>
                  <span className="font-mono">{parsed.hostname}</span>
                  <span className="text-muted-foreground">Username:</span>
                  <span className="font-mono">{parsed.username}</span>
                  <span className="text-muted-foreground">Password:</span>
                  <span className="font-mono">{parsed.password}</span>
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-mono">{parsed.type}</span>
                  <span className="text-muted-foreground">Output:</span>
                  <span className="font-mono">{parsed.output}</span>
                </div>
              </div>
            )}
            {parsed?.error && (
              <p className="text-sm text-red-500">{parsed.error}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Complete M3U URL Converter & Parser Tool</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            The ultimate online tool for IPTV enthusiasts to convert credentials
            into M3U playlist URLs and parse existing URLs to extract
            authentication details.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
