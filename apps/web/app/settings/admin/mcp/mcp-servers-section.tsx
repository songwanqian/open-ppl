"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Pencil, Plus, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { fetcher } from "@/lib/swr";

type McpServer = {
  id: string;
  name: string;
  purpose: "search" | "web_fetch" | "general";
  url: string;
  headers: Record<string, string>;
  enabled: boolean;
};

type ServersResponse = {
  servers: McpServer[];
};

type TestResult = {
  success: boolean;
  latency: number;
  tools?: string[];
  error?: string;
} | null;

const EMPTY_SERVERS: McpServer[] = [];

function parseHeaders(value: string): Record<string, string> {
  if (!value.trim()) {
    return {};
  }
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Headers must be a JSON object");
  }
  for (const [key, headerValue] of Object.entries(parsed)) {
    if (typeof key !== "string" || typeof headerValue !== "string") {
      throw new Error("Headers must be a string map");
    }
  }
  return parsed as Record<string, string>;
}

export function McpServersSection() {
  const { data, isLoading, mutate } = useSWR<ServersResponse>(
    "/api/admin/mcp-servers",
    fetcher,
  );
  const servers = data?.servers ?? EMPTY_SERVERS;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<McpServer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult>(null);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState<McpServer["purpose"]>("search");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState("{}");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!dialogOpen) {
      return;
    }
    setTestResult(null);
    if (editing) {
      setName(editing.name);
      setPurpose(editing.purpose);
      setUrl(editing.url);
      setHeaders(JSON.stringify(editing.headers ?? {}, null, 2));
      setEnabled(editing.enabled);
      return;
    }
    setName("");
    setPurpose("search");
    setUrl("");
    setHeaders("{}");
    setEnabled(true);
  }, [dialogOpen, editing]);

  const saveServer = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch(
        editing
          ? `/api/admin/mcp-servers/${editing.id}`
          : "/api/admin/mcp-servers",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            purpose,
            url: url.trim(),
            headers: parseHeaders(headers),
            enabled,
          }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Failed to save MCP server");
      }
      await mutate();
      setDialogOpen(false);
      toast.success(editing ? "MCP server updated" : "MCP server created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteServer = async (server: McpServer) => {
    if (!window.confirm(`Delete "${server.name}"?`)) {
      return;
    }
    const response = await fetch(`/api/admin/mcp-servers/${server.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Failed to delete MCP server");
      return;
    }
    await mutate();
    toast.success("MCP server deleted");
  };

  const testServer = async (server: McpServer) => {
    setTestingId(server.id);
    setTestResult(null);
    try {
      const response = await fetch(`/api/admin/mcp-servers/${server.id}/test`, {
        method: "POST",
      });
      const result = (await response.json()) as TestResult;
      setTestResult(result);
    } catch {
      setTestResult({
        success: false,
        latency: 0,
        error: "Network error",
      });
    } finally {
      setTestingId(null);
    }
  };

  if (isLoading) {
    return <div className="h-32 animate-pulse rounded-md bg-muted/50" />;
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Servers
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Only public HTTP or HTTPS MCP endpoints are accepted.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>

        <div className="divide-y divide-border rounded-md border border-border">
          {servers.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              No MCP servers configured.
            </div>
          ) : (
            servers.map((server) => (
              <div
                key={server.id}
                className="flex items-start justify-between gap-4 p-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{server.name}</p>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {server.purpose}
                    </span>
                    {server.enabled && (
                      <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-xs text-green-700 dark:text-green-400">
                        Enabled
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {server.url}
                  </p>
                  {testingId === server.id && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Testing MCP tools
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void testServer(server)}
                  >
                    <Wrench className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(server);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void deleteServer(server)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {testResult && (
          <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
            {testResult.success ? (
              <div className="space-y-2">
                <p className="font-medium">
                  Connected in {testResult.latency}ms
                </p>
                <p className="text-muted-foreground">
                  Tools: {testResult.tools?.join(", ") || "none"}
                </p>
              </div>
            ) : (
              <p className="text-destructive">
                {testResult.error ?? "MCP test failed"}
              </p>
            )}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={(event) => void saveServer(event)}>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit MCP server" : "Add MCP server"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="mcp-name">Name</Label>
                <Input
                  id="mcp-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Purpose</Label>
                <Select
                  value={purpose}
                  onValueChange={(value) =>
                    setPurpose(value as McpServer["purpose"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="search">Search</SelectItem>
                    <SelectItem value="web_fetch">Web fetch</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mcp-url">URL</Label>
                <Input
                  id="mcp-url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.com/mcp"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mcp-headers">Headers JSON</Label>
                <textarea
                  id="mcp-headers"
                  value={headers}
                  onChange={(event) => setHeaders(event.target.value)}
                  className="min-h-28 rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <label
                className="flex items-center justify-between rounded-md border border-border p-3"
                htmlFor="mcp-enabled"
              >
                <span className="text-sm font-medium">Enabled</span>
                <Switch
                  checked={enabled}
                  id="mcp-enabled"
                  onCheckedChange={setEnabled}
                />
              </label>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
