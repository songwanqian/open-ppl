"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Eye, EyeOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { fetcher } from "@/lib/swr";

interface GatewayAccount {
  id: string;
  name: string;
  provider: string;
  baseURL: string;
  apiKey: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AccountsResponse {
  accounts: GatewayAccount[];
}

const EMPTY_ACCOUNTS: GatewayAccount[] = [];

export function GatewayAccountsSection() {
  const { data, isLoading, mutate } = useSWR<AccountsResponse>(
    "/api/admin/gateway-accounts",
    fetcher,
  );
  const accounts = data?.accounts ?? EMPTY_ACCOUNTS;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<GatewayAccount | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("openai-compatible");
  const [baseURL, setBaseURL] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (dialogOpen) {
      if (editingAccount) {
        setName(editingAccount.name);
        setProvider(editingAccount.provider);
        setBaseURL(editingAccount.baseURL);
        setApiKey("");
        setEnabled(editingAccount.enabled);
      } else {
        setName("");
        setProvider("openai-compatible");
        setBaseURL("");
        setApiKey("");
        setEnabled(true);
      }
    }
  }, [dialogOpen, editingAccount]);

  const handleOpenCreate = () => {
    setEditingAccount(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (account: GatewayAccount) => {
    setEditingAccount(account);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !baseURL.trim()) return;

    setIsSaving(true);
    try {
      const method = editingAccount ? "PATCH" : "POST";
      const url = editingAccount
        ? `/api/admin/gateway-accounts/${editingAccount.id}`
        : "/api/admin/gateway-accounts";
      const body = editingAccount
        ? {
            name: name.trim(),
            provider,
            baseURL: baseURL.trim(),
            ...(apiKey ? { apiKey } : {}),
            enabled,
          }
        : {
            name: name.trim(),
            provider,
            baseURL: baseURL.trim(),
            apiKey: apiKey || undefined,
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
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
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
              <Input
                id="gw-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="openai-compatible"
                disabled={isSaving}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gw-baseurl" className="text-xs font-medium">
                Base URL
              </Label>
              <Input
                id="gw-baseurl"
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
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
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                disabled={isSaving}
              />
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
              <Button type="submit" size="sm" disabled={isSaving}>
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
    </>
  );
}
