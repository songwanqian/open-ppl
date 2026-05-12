"use client";

import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import {
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GATEWAY_PROVIDER_PRESETS,
  isGatewayProviderId,
  normalizeGatewayProvider,
} from "@/lib/gateway-providers";
import { fetcher } from "@/lib/swr";

interface GatewayAccount {
  id: string;
  name: string;
  provider: string;
  baseURL: string;
  apiKey: string | null;
  modelFilter: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RemoteModel {
  id: string;
  name: string;
}

interface AccountsResponse {
  accounts: GatewayAccount[];
}

interface RemoteModelsResponse {
  models: RemoteModel[];
}

const EMPTY_ACCOUNTS: GatewayAccount[] = [];

type ConnectionTestResult = {
  success: boolean;
  latency: number;
  modelCount?: number;
  error?: string;
} | null;

export function GatewayAccountsSection() {
  const { data, isLoading, mutate } = useSWR<AccountsResponse>(
    "/api/admin/gateway-accounts",
    fetcher,
  );
  const accounts = data?.accounts ?? EMPTY_ACCOUNTS;

  // Account form dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<GatewayAccount | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("openai-compatible");
  const [baseURL, setBaseURL] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});

  // Connection test state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult>(null);

  // Remote models dialog state
  const [remoteModelsOpen, setRemoteModelsOpen] = useState(false);
  const [viewingAccountId, setViewingAccountId] = useState<string | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [remoteModels, setRemoteModels] = useState<RemoteModel[]>([]);
  const [selectedRemoteModels, setSelectedRemoteModels] = useState<Set<string>>(
    new Set(),
  );
  const [isImporting, setIsImporting] = useState(false);

  const resetForm = useCallback(() => {
    setName("");
    setProvider("openai-compatible");
    setBaseURL("");
    setApiKey("");
    setModelFilter("");
    setEnabled(true);
    setTestResult(null);
  }, []);

  useEffect(() => {
    if (dialogOpen) {
      if (editingAccount) {
        setName(editingAccount.name);
        setProvider(
          normalizeGatewayProvider(editingAccount.provider) ??
            editingAccount.provider,
        );
        setBaseURL(editingAccount.baseURL);
        setApiKey("");
        setModelFilter(editingAccount.modelFilter ?? "");
        setEnabled(editingAccount.enabled);
      } else {
        resetForm();
      }
      setTestResult(null);
    }
  }, [dialogOpen, editingAccount, resetForm]);

  const handleOpenCreate = () => {
    setEditingAccount(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (account: GatewayAccount) => {
    setEditingAccount(account);
    setDialogOpen(true);
  };

  const handleProviderChange = (value: string) => {
    setProvider(value);
    setTestResult(null);
    const preset = GATEWAY_PROVIDER_PRESETS.find((p) => p.value === value);
    if (preset?.baseURL && !baseURL) {
      setBaseURL(preset.baseURL);
    }
  };

  const resolvedProvider = normalizeGatewayProvider(provider);

  const handleTestConnection = async () => {
    if (!baseURL.trim() || !resolvedProvider) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/admin/gateway-accounts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: resolvedProvider,
          baseURL: baseURL.trim(),
          apiKey: apiKey || undefined,
        }),
      });
      const result = (await response.json()) as ConnectionTestResult &
        Record<string, unknown>;
      setTestResult(result as ConnectionTestResult);
    } catch {
      setTestResult({
        success: false,
        latency: 0,
        error: "Network error",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleViewModels = async (account: GatewayAccount) => {
    setViewingAccountId(account.id);
    setIsLoadingModels(true);
    setRemoteModelsOpen(true);
    setSelectedRemoteModels(new Set());
    try {
      const response = await fetch(
        `/api/admin/gateway-accounts/${account.id}/remote-models`,
      );
      const data = (await response.json()) as RemoteModelsResponse;
      setRemoteModels(data.models ?? []);
    } catch {
      toast.error("Failed to fetch remote models");
      setRemoteModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleImportModels = async () => {
    if (!viewingAccountId || selectedRemoteModels.size === 0) return;
    setIsImporting(true);
    try {
      const imports = Array.from(selectedRemoteModels).map((modelId) => {
        const model = remoteModels.find((m) => m.id === modelId);
        return {
          name: model?.name || modelId,
          modelId,
          remoteModelId: modelId,
          gatewayAccountId: viewingAccountId,
        };
      });
      const response = await fetch("/api/admin/gateway-models/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imports }),
      });
      const result = (await response.json()) as {
        created: number;
        failed: number;
      };
      toast.success(
        `Imported ${result.created} models${result.failed > 0 ? `, ${result.failed} failed` : ""}`,
      );
      setRemoteModelsOpen(false);
      mutate();
    } catch {
      toast.error("Failed to import models");
    } finally {
      setIsImporting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !baseURL.trim() || !resolvedProvider) return;

    setIsSaving(true);
    try {
      const method = editingAccount ? "PATCH" : "POST";
      const url = editingAccount
        ? `/api/admin/gateway-accounts/${editingAccount.id}`
        : "/api/admin/gateway-accounts";
      const body = editingAccount
        ? {
            name: name.trim(),
            provider: resolvedProvider,
            baseURL: baseURL.trim(),
            ...(apiKey ? { apiKey } : {}),
            modelFilter: modelFilter.trim() || null,
            enabled,
          }
        : {
            name: name.trim(),
            provider: resolvedProvider,
            baseURL: baseURL.trim(),
            apiKey: apiKey || undefined,
            modelFilter: modelFilter.trim() || null,
            enabled,
          };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = (await response.json()) as { error?: string };
        toast.error(err.error ?? "Failed to save gateway account");
        return;
      }

      await mutate();
      setDialogOpen(false);
      toast.success(
        editingAccount ? "Gateway account updated" : "Gateway account created",
      );
    } catch {
      toast.error("Failed to save gateway account");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        "Delete this gateway account? All associated models will also be deleted.",
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/gateway-accounts/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        toast.error("Failed to delete gateway account");
        return;
      }
      await mutate();
      toast.success("Gateway account deleted");
    } catch {
      toast.error("Failed to delete gateway account");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/50" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Gateway Accounts
            </h3>
            <p className="text-sm text-muted-foreground">
              Upstream API provider accounts that models route through.
            </p>
          </div>
          <Button size="sm" onClick={handleOpenCreate} className="shrink-0">
            <Plus className="size-3.5" />
            New Account
          </Button>
        </div>

        <div className="divide-y divide-border rounded-lg border border-border">
          {accounts.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No gateway accounts configured. Create one to add models.
            </div>
          ) : (
            accounts.map((account) => (
              <div
                key={account.id}
                className="group flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{account.name}</span>
                    {!account.enabled && (
                      <span className="rounded-sm bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        Disabled
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {account.baseURL}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{account.provider}</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="flex items-center gap-1">
                      API Key:{" "}
                      {account.apiKey ? (
                        <>
                          {showApiKey[account.id]
                            ? account.apiKey.slice(0, 8) + "..."
                            : "••••••••"}
                          <button
                            type="button"
                            onClick={() =>
                              setShowApiKey((prev) => ({
                                ...prev,
                                [account.id]: !prev[account.id],
                              }))
                            }
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {showApiKey[account.id] ? (
                              <EyeOff className="size-3" />
                            ) : (
                              <Eye className="size-3" />
                            )}
                          </button>
                        </>
                      ) : (
                        "Not set"
                      )}
                    </span>
                    {account.modelFilter && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="truncate">
                          Filter: /{account.modelFilter}/
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => handleViewModels(account)}
                    className="size-7"
                    title="View & import remote models"
                  >
                    <ChevronRight className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => handleOpenEdit(account)}
                    className="size-7"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => handleDelete(account.id)}
                    className="size-7 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Account Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? "Edit Gateway Account" : "New Gateway Account"}
            </DialogTitle>
            <DialogDescription>
              {editingAccount
                ? "Update the gateway account configuration."
                : "Configure an upstream API provider account."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="gw-name" className="text-xs font-medium">
                  Name
                </Label>
                <Input
                  id="gw-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. GitHub Models"
                  disabled={isSaving}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="gw-provider" className="text-xs font-medium">
                  Provider
                </Label>
                <Select
                  value={provider}
                  onValueChange={handleProviderChange}
                  disabled={isSaving}
                >
                  <SelectTrigger id="gw-provider">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {GATEWAY_PROVIDER_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                    {!isGatewayProviderId(provider) && (
                      <SelectItem value={provider} disabled>
                        Unsupported: {provider}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="gw-baseurl" className="text-xs font-medium">
                Base URL
              </Label>
              <Input
                id="gw-baseurl"
                value={baseURL}
                onChange={(e) => {
                  setBaseURL(e.target.value);
                  setTestResult(null);
                }}
                placeholder="https://api.example.com/v1"
                disabled={isSaving}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="gw-apikey" className="text-xs font-medium">
                API Key{" "}
                {editingAccount && (
                  <span className="font-normal text-muted-foreground">
                    (leave empty to keep current)
                  </span>
                )}
              </Label>
              <Input
                id="gw-apikey"
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder="sk-..."
                disabled={isSaving}
              />
            </div>

            {/* Test Connection */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={isTesting || !baseURL.trim() || !resolvedProvider}
              >
                {isTesting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                {isTesting ? "Testing..." : "Test Connection"}
              </Button>
              {testResult && (
                <div className="flex items-center gap-1.5 text-xs">
                  {testResult.success ? (
                    <>
                      <CheckCircle2 className="size-3.5 text-green-500" />
                      <span className="text-green-600">
                        Connected ({testResult.latency}ms)
                        {testResult.modelCount !== undefined
                          ? ` · ${testResult.modelCount} models found`
                          : ""}
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="size-3.5 text-red-500" />
                      <span className="text-red-600">
                        Failed: {testResult.error}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="gw-filter" className="text-xs font-medium">
                Model Filter{" "}
                <span className="font-normal text-muted-foreground">
                  (regex, optional)
                </span>
              </Label>
              <Input
                id="gw-filter"
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                placeholder="e.g. gpt-4|claude"
                disabled={isSaving}
              />
              <p className="text-[11px] text-muted-foreground">
                Regular expression to filter remote models. Only matching models
                will appear when importing.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="gw-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
                disabled={isSaving}
              />
              <Label htmlFor="gw-enabled" className="text-xs font-medium">
                Enabled
              </Label>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSaving || !resolvedProvider}
              >
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                {isSaving
                  ? "Saving..."
                  : editingAccount
                    ? "Save Changes"
                    : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remote Models Import Dialog */}
      <Dialog open={remoteModelsOpen} onOpenChange={setRemoteModelsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Remote Models</DialogTitle>
            <DialogDescription>
              Select models to import from{" "}
              {accounts.find((a) => a.id === viewingAccountId)?.name ??
                "this account"}
              .
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {isLoadingModels ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : remoteModels.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No models found.
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-1 pb-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs text-muted-foreground"
                    onClick={() => {
                      if (selectedRemoteModels.size === remoteModels.length) {
                        setSelectedRemoteModels(new Set());
                      } else {
                        setSelectedRemoteModels(
                          new Set(remoteModels.map((m) => m.id)),
                        );
                      }
                    }}
                  >
                    {selectedRemoteModels.size === remoteModels.length
                      ? "Deselect all"
                      : "Select all"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {selectedRemoteModels.size} of {remoteModels.length}{" "}
                    selected
                  </span>
                </div>
                {remoteModels.map((model) => (
                  <label
                    key={model.id}
                    aria-label={`Select ${model.name || model.id}`}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRemoteModels.has(model.id)}
                      onChange={() => {
                        setSelectedRemoteModels((prev) => {
                          const next = new Set(prev);
                          if (next.has(model.id)) {
                            next.delete(model.id);
                          } else {
                            next.add(model.id);
                          }
                          return next;
                        });
                      }}
                      className="size-3.5 rounded border-border"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{model.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {model.id}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRemoteModelsOpen(false)}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isImporting || selectedRemoteModels.size === 0}
              onClick={handleImportModels}
            >
              {isImporting ? <Loader2 className="size-4 animate-spin" /> : null}
              {isImporting
                ? "Importing..."
                : `Import ${selectedRemoteModels.size} Model${selectedRemoteModels.size !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
