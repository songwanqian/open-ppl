"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
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
import { Textarea } from "@/components/ui/textarea";
import { fetcher } from "@/lib/swr";

interface GatewayModel {
  id: string;
  name: string;
  modelId: string;
  enabled: boolean;
}

interface GatewayModelVariant {
  id: string;
  name: string;
  baseModelId: string;
  providerOptions: Record<string, unknown>;
  enabled: boolean;
}

interface ModelsResponse {
  models: GatewayModel[];
}

interface VariantsResponse {
  variants: GatewayModelVariant[];
}

const EMPTY_MODELS: GatewayModel[] = [];
const EMPTY_VARIANTS: GatewayModelVariant[] = [];

const COMMON_OPTIONS = [
  { key: "temperature", label: "Temperature", min: 0, max: 2, step: 0.1 },
  { key: "maxTokens", label: "Max Tokens", min: 1, max: 1000000, step: 1 },
  { key: "topP", label: "Top P", min: 0, max: 1, step: 0.1 },
] as const;

function parseNumericOption(
  options: Record<string, unknown>,
  key: string,
): string {
  const val = options[key];
  if (typeof val === "number") return val.toString();
  return "";
}

function updateOption(text: string, key: string, value: unknown): string {
  try {
    const obj = JSON.parse(text || "{}");
    if (value === "" || value === undefined || value === null) {
      delete obj[key];
    } else {
      obj[key] = value;
    }
    return JSON.stringify(obj, null, 2);
  } catch {
    return text;
  }
}

export function GatewayModelVariantsSection() {
  const { data: modelsData } = useSWR<ModelsResponse>(
    "/api/admin/gateway-models",
    fetcher,
  );
  const {
    data: variantsData,
    isLoading,
    mutate,
  } = useSWR<VariantsResponse>("/api/admin/gateway-model-variants", fetcher);

  const models = modelsData?.models ?? EMPTY_MODELS;
  const variants = variantsData?.variants ?? EMPTY_VARIANTS;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] =
    useState<GatewayModelVariant | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [baseModelId, setBaseModelId] = useState("");
  const [providerOptionsText, setProviderOptionsText] = useState("{}");
  const [enabled, setEnabled] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const modelNameById = models.reduce<Record<string, string>>((acc, m) => {
    acc[m.modelId] = m.name;
    return acc;
  }, {});

  const parsedOptions: Record<string, unknown> = (() => {
    try {
      return JSON.parse(providerOptionsText || "{}");
    } catch {
      return {};
    }
  })();

  const hasAdvancedOptions = Object.keys(parsedOptions).some(
    (key) => !COMMON_OPTIONS.some((opt) => opt.key === key),
  );

  useEffect(() => {
    if (dialogOpen) {
      if (editingVariant) {
        setName(editingVariant.name);
        setBaseModelId(editingVariant.baseModelId);
        setProviderOptionsText(
          JSON.stringify(editingVariant.providerOptions ?? {}, null, 2),
        );
        setEnabled(editingVariant.enabled);
      } else {
        setName("");
        setBaseModelId(models[0]?.modelId ?? "");
        setProviderOptionsText("{}");
        setEnabled(true);
      }
      setShowAdvanced(false);
    }
  }, [dialogOpen, editingVariant, models]);

  const handleOpenCreate = () => {
    setEditingVariant(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (variant: GatewayModelVariant) => {
    setEditingVariant(variant);
    setDialogOpen(true);
  };

  const handleCommonOptionChange = (key: string, value: string) => {
    const numVal = value === "" ? undefined : parseFloat(value);
    const newOptions =
      numVal !== undefined && !isNaN(numVal)
        ? updateOption(providerOptionsText, key, numVal)
        : updateOption(providerOptionsText, key, undefined);
    setProviderOptionsText(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !baseModelId) return;

    let parsedOpts: Record<string, unknown>;
    try {
      parsedOpts = JSON.parse(providerOptionsText || "{}");
    } catch {
      toast.error("Provider options must be valid JSON");
      return;
    }

    setIsSaving(true);
    try {
      const method = editingVariant ? "PATCH" : "POST";
      const url = editingVariant
        ? `/api/admin/gateway-model-variants/${editingVariant.id}`
        : "/api/admin/gateway-model-variants";
      const body = {
        name: name.trim(),
        baseModelId,
        providerOptions: parsedOpts,
        enabled,
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = (await response.json()) as { error?: string };
        toast.error(err.error ?? "Failed to save variant");
        return;
      }

      await mutate();
      setDialogOpen(false);
      toast.success(editingVariant ? "Variant updated" : "Variant created");
    } catch {
      toast.error("Failed to save variant");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this built-in variant?")) return;

    try {
      const response = await fetch(`/api/admin/gateway-model-variants/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        toast.error("Failed to delete variant");
        return;
      }
      await mutate();
      toast.success("Variant deleted");
    } catch {
      toast.error("Failed to delete variant");
    }
  };

  if (isLoading) {
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
              Built-in Model Variants
            </h3>
            <p className="text-sm text-muted-foreground">
              Pre-configured model presets available to all users. These appear
              alongside regular models in the model selector.
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleOpenCreate}
            disabled={models.length === 0}
            className="shrink-0"
          >
            <Plus className="size-3.5" />
            New Variant
          </Button>
        </div>

        <div className="divide-y divide-border rounded-lg border border-border">
          {variants.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No built-in variants configured.
            </div>
          ) : (
            variants.map((variant) => {
              const optionKeys = Object.keys(variant.providerOptions ?? {});
              return (
                <div
                  key={variant.id}
                  className="group flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {variant.name}
                      </span>
                      {!variant.enabled && (
                        <span className="rounded-sm bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          Disabled
                        </span>
                      )}
                      <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        Built-in
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {modelNameById[variant.baseModelId] ??
                        variant.baseModelId}
                      {optionKeys.length > 0 &&
                        ` · ${optionKeys.length} option${optionKeys.length > 1 ? "s" : ""}`}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => handleOpenEdit(variant)}
                      className="size-7"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => handleDelete(variant.id)}
                      className="size-7 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Variant Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingVariant
                ? "Edit Built-in Variant"
                : "New Built-in Variant"}
            </DialogTitle>
            <DialogDescription>
              {editingVariant
                ? "Update the built-in variant configuration."
                : "Create a pre-configured model preset for all users."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="bv-name" className="text-xs font-medium">
                  Name
                </Label>
                <Input
                  id="bv-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Claude Adaptive Thinking"
                  disabled={isSaving}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="bv-model" className="text-xs font-medium">
                  Base Model
                </Label>
                <select
                  id="bv-model"
                  value={baseModelId}
                  onChange={(e) => setBaseModelId(e.target.value)}
                  disabled={isSaving}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select a model</option>
                  {models.map((model) => (
                    <option key={model.id} value={model.modelId}>
                      {model.name} ({model.modelId})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Common Options */}
            <div className="space-y-3">
              <Label className="text-xs font-medium">Provider Options</Label>
              <div className="grid grid-cols-3 gap-3">
                {COMMON_OPTIONS.map((opt) => (
                  <div key={opt.key} className="grid gap-1">
                    <Label
                      htmlFor={`bv-${opt.key}`}
                      className="text-[11px] text-muted-foreground"
                    >
                      {opt.label}
                    </Label>
                    {opt.key === "maxTokens" ? (
                      <Input
                        id={`bv-${opt.key}`}
                        type="number"
                        min={opt.min}
                        max={opt.max}
                        step={opt.step}
                        value={parseNumericOption(parsedOptions, opt.key)}
                        onChange={(e) =>
                          handleCommonOptionChange(opt.key, e.target.value)
                        }
                        placeholder="—"
                        disabled={isSaving}
                        className="h-8 text-xs"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={opt.min}
                          max={opt.max}
                          step={opt.step}
                          value={
                            parseNumericOption(parsedOptions, opt.key) ||
                            opt.min
                          }
                          onChange={(e) =>
                            handleCommonOptionChange(opt.key, e.target.value)
                          }
                          disabled={isSaving}
                          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                        />
                        <span className="w-8 text-right text-[11px] tabular-nums text-muted-foreground">
                          {parseNumericOption(parsedOptions, opt.key) || "—"}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Advanced JSON Editor */}
            <div className="space-y-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto gap-1 px-0 py-0 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? (
                  <ChevronUp className="size-3" />
                ) : (
                  <ChevronDown className="size-3" />
                )}
                Advanced JSON Editor
                {hasAdvancedOptions && !showAdvanced && (
                  <span className="rounded-sm bg-amber-500/20 px-1 text-amber-600">
                    has custom keys
                  </span>
                )}
              </Button>
              {showAdvanced && (
                <Textarea
                  value={providerOptionsText}
                  onChange={(e) => setProviderOptionsText(e.target.value)}
                  className="min-h-32 resize-y rounded-md border-border bg-muted/30 font-mono text-xs leading-relaxed"
                  placeholder='{"reasoningEffort": "medium"}'
                  disabled={isSaving}
                />
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="bv-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
                disabled={isSaving}
              />
              <Label htmlFor="bv-enabled" className="text-xs font-medium">
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
                  : editingVariant
                    ? "Save Changes"
                    : "Create Variant"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
