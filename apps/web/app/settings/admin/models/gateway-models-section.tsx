"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { ChevronDown, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { fetcher } from "@/lib/swr";

interface GatewayAccount {
  id: string;
  name: string;
  baseURL: string;
  apiKey: string | null;
  modelFilter: string | null;
}

interface RemoteModel {
  id: string;
  name: string;
}

interface GatewayModel {
  id: string;
  name: string;
  modelId: string;
  remoteModelId: string | null;
  gatewayAccountId: string;
  enabled: boolean;
  description: string | null;
  contextWindow: number | null;
  isDefault: boolean;
}

interface ModelsResponse {
  models: GatewayModel[];
}

interface AccountsResponse {
  accounts: GatewayAccount[];
}

const EMPTY_MODELS: GatewayModel[] = [];
const EMPTY_ACCOUNTS: GatewayAccount[] = [];

export function GatewayModelsSection() {
  const {
    data: modelsData,
    isLoading: modelsLoading,
    mutate,
  } = useSWR<ModelsResponse>("/api/admin/gateway-models", fetcher);
  const { data: accountsData } = useSWR<AccountsResponse>(
    "/api/admin/gateway-accounts",
    fetcher,
  );

  const models = modelsData?.models ?? EMPTY_MODELS;
  const accounts = accountsData?.accounts ?? EMPTY_ACCOUNTS;

  const accountNameById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.name])),
    [accounts],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<GatewayModel | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [modelId, setModelId] = useState("");
  const [remoteModelId, setRemoteModelId] = useState("");
  const [gatewayAccountId, setGatewayAccountId] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [description, setDescription] = useState("");
  const [contextWindow, setContextWindow] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  // Remote model fetcher state
  const [remoteModelsPopoverOpen, setRemoteModelsPopoverOpen] = useState(false);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [remoteModels, setRemoteModels] = useState<RemoteModel[]>([]);

  useEffect(() => {
    if (dialogOpen) {
      if (editingModel) {
        setName(editingModel.name);
        setModelId(editingModel.modelId);
        setRemoteModelId(editingModel.remoteModelId ?? "");
        setGatewayAccountId(editingModel.gatewayAccountId);
        setEnabled(editingModel.enabled);
        setDescription(editingModel.description ?? "");
        setContextWindow(editingModel.contextWindow?.toString() ?? "");
        setIsDefault(editingModel.isDefault);
      } else {
        setName("");
        setModelId("");
        setRemoteModelId("");
        setGatewayAccountId(accounts[0]?.id ?? "");
        setEnabled(true);
        setDescription("");
        setContextWindow("");
        setIsDefault(false);
      }
    }
  }, [dialogOpen, editingModel, accounts]);

  const handleOpenCreate = () => {
    setEditingModel(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (model: GatewayModel) => {
    setEditingModel(model);
    setDialogOpen(true);
  };

  const handleFetchRemoteModels = async () => {
    if (!gatewayAccountId) return;
    setIsLoadingRemote(true);
    setRemoteModelsPopoverOpen(true);
    try {
      const response = await fetch(
        `/api/admin/gateway-accounts/${gatewayAccountId}/remote-models`,
      );
      const data = (await response.json()) as {
        models?: RemoteModel[];
        error?: string;
      };
      if (data.error) {
        toast.error(data.error);
        setRemoteModels([]);
      } else {
        setRemoteModels(data.models ?? []);
      }
    } catch {
      toast.error("Failed to fetch remote models");
      setRemoteModels([]);
    } finally {
      setIsLoadingRemote(false);
    }
  };

  const handleSelectRemoteModel = (model: RemoteModel) => {
    setRemoteModelId(model.id);
    if (!name) {
      setName(model.name || model.id);
    }
    setRemoteModelsPopoverOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !modelId.trim() || !gatewayAccountId) return;

    setIsSaving(true);
    try {
      const method = editingModel ? "PATCH" : "POST";
      const url = editingModel
        ? `/api/admin/gateway-models/${editingModel.id}`
        : "/api/admin/gateway-models";
      const body = {
        name: name.trim(),
        modelId: modelId.trim(),
        remoteModelId: remoteModelId.trim() || null,
        gatewayAccountId,
        enabled,
        description: description.trim() || null,
        contextWindow: contextWindow ? parseInt(contextWindow, 10) : null,
        isDefault,
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = (await response.json()) as { error?: string };
        toast.error(err.error ?? "Failed to save model");
        return;
      }

      await mutate();
      setDialogOpen(false);
      toast.success(editingModel ? "Model updated" : "Model created");
    } catch {
      toast.error("Failed to save model");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this model?")) return;

    try {
      const response = await fetch(`/api/admin/gateway-models/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        toast.error("Failed to delete model");
        return;
      }
      await mutate();
      toast.success("Model deleted");
    } catch {
      toast.error("Failed to delete model");
    }
  };

  if (modelsLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/50" />
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
              Models
            </h3>
            <p className="text-sm text-muted-foreground">
              Models available to users. Only enabled models are shown in
              selectors.
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleOpenCreate}
            disabled={accounts.length === 0}
            className="shrink-0"
          >
            <Plus className="size-3.5" />
            New Model
          </Button>
        </div>

        {accounts.length === 0 && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
            <p className="text-xs text-amber-400">
              Create a Gateway Account first before adding models.
            </p>
          </div>
        )}

        <div className="divide-y divide-border rounded-lg border border-border">
          {models.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No models configured.
            </div>
          ) : (
            models.map((model) => (
              <div
                key={model.id}
                className="group flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{model.name}</span>
                    {model.isDefault && (
                      <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        Default
                      </span>
                    )}
                    {!model.enabled && (
                      <span className="rounded-sm bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        Disabled
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {model.modelId}
                    {model.remoteModelId &&
                    model.remoteModelId !== model.modelId
                      ? ` → ${model.remoteModelId}`
                      : ""}
                    {model.contextWindow
                      ? ` · ${Math.round(model.contextWindow / 1000)}k context`
                      : ""}
                  </div>
                  <div className="text-xs text-muted-foreground/70">
                    via{" "}
                    {accountNameById.get(model.gatewayAccountId) ?? "Unknown"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => handleOpenEdit(model)}
                    className="size-7"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => handleDelete(model.id)}
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

      {/* Model Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingModel ? "Edit Model" : "New Model"}
            </DialogTitle>
            <DialogDescription>
              {editingModel
                ? "Update the model configuration."
                : "Add a new model for users to select."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="gm-name" className="text-xs font-medium">
                  Display Name
                </Label>
                <Input
                  id="gm-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Claude Sonnet 4"
                  disabled={isSaving}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="gm-account" className="text-xs font-medium">
                  Gateway Account
                </Label>
                <Select
                  value={gatewayAccountId}
                  onValueChange={setGatewayAccountId}
                  disabled={isSaving}
                >
                  <SelectTrigger id="gm-account">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="gm-modelid" className="text-xs font-medium">
                  System Model ID
                </Label>
                <Input
                  id="gm-modelid"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  placeholder="e.g. anthropic/claude-sonnet-4.5"
                  disabled={isSaving}
                />
                <p className="text-[11px] text-muted-foreground">
                  Used internally for model matching, format: provider/model
                </p>
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="gm-remoteid" className="text-xs font-medium">
                    Remote Model ID
                  </Label>
                  {gatewayAccountId && (
                    <Popover
                      open={remoteModelsPopoverOpen}
                      onOpenChange={setRemoteModelsPopoverOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto gap-1 px-1 py-0 text-[11px] text-muted-foreground"
                          onClick={handleFetchRemoteModels}
                        >
                          Fetch from gateway
                          <ChevronDown className="size-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0" align="end">
                        <div className="max-h-64 overflow-y-auto">
                          {isLoadingRemote ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="size-4 animate-spin text-muted-foreground" />
                            </div>
                          ) : remoteModels.length === 0 ? (
                            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                              No models found
                            </div>
                          ) : (
                            remoteModels.map((model) => (
                              <button
                                key={model.id}
                                type="button"
                                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-muted/50"
                                onClick={() => handleSelectRemoteModel(model)}
                              >
                                <span className="truncate text-sm">
                                  {model.name || model.id}
                                </span>
                                <span className="truncate text-xs text-muted-foreground">
                                  {model.id}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
                <Input
                  id="gm-remoteid"
                  value={remoteModelId}
                  onChange={(e) => setRemoteModelId(e.target.value)}
                  placeholder="e.g. claude-sonnet-4-20250514"
                  disabled={isSaving}
                />
                <p className="text-[11px] text-muted-foreground">
                  Actual ID sent to gateway API. Leave empty to use System Model
                  ID.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="gm-desc" className="text-xs font-medium">
                  Description
                </Label>
                <Input
                  id="gm-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  disabled={isSaving}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="gm-ctx" className="text-xs font-medium">
                  Context Window
                </Label>
                <Input
                  id="gm-ctx"
                  type="number"
                  value={contextWindow}
                  onChange={(e) => setContextWindow(e.target.value)}
                  placeholder="e.g. 200000"
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="gm-enabled"
                  checked={enabled}
                  onCheckedChange={setEnabled}
                  disabled={isSaving}
                />
                <Label htmlFor="gm-enabled" className="text-xs font-medium">
                  Enabled
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="gm-default"
                  checked={isDefault}
                  onCheckedChange={setIsDefault}
                  disabled={isSaving}
                />
                <Label htmlFor="gm-default" className="text-xs font-medium">
                  Default
                </Label>
              </div>
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
                  : editingModel
                    ? "Save Changes"
                    : "Create Model"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
