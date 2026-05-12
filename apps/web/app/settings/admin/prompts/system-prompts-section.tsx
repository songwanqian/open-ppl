"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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

type SystemPrompt = {
  id: string;
  name: string;
  mode: "computer" | "search";
  content: string;
  enabled: boolean;
};

type PromptsResponse = {
  prompts: SystemPrompt[];
};

const EMPTY_PROMPTS: SystemPrompt[] = [];

export function SystemPromptsSection() {
  const { data, isLoading, mutate } = useSWR<PromptsResponse>(
    "/api/admin/system-prompts",
    fetcher,
  );
  const prompts = data?.prompts ?? EMPTY_PROMPTS;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SystemPrompt | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"computer" | "search">("search");
  const [content, setContent] = useState("");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!dialogOpen) {
      return;
    }
    if (editing) {
      setName(editing.name);
      setMode(editing.mode);
      setContent(editing.content);
      setEnabled(editing.enabled);
      return;
    }
    setName("");
    setMode("search");
    setContent("");
    setEnabled(true);
  }, [dialogOpen, editing]);

  const savePrompt = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch(
        editing
          ? `/api/admin/system-prompts/${editing.id}`
          : "/api/admin/system-prompts",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            mode,
            content: content.trim(),
            enabled,
          }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Failed to save prompt");
      }
      await mutate();
      setDialogOpen(false);
      toast.success(editing ? "Prompt updated" : "Prompt created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const deletePrompt = async (prompt: SystemPrompt) => {
    if (!window.confirm(`Delete "${prompt.name}"?`)) {
      return;
    }
    const response = await fetch(`/api/admin/system-prompts/${prompt.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Failed to delete prompt");
      return;
    }
    await mutate();
    toast.success("Prompt deleted");
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
              Prompts
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Search mode requires exactly one enabled Search prompt.
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
          {prompts.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              No prompts configured.
            </div>
          ) : (
            prompts.map((prompt) => (
              <div
                key={prompt.id}
                className="flex items-start justify-between gap-4 p-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{prompt.name}</p>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {prompt.mode}
                    </span>
                    {prompt.enabled && (
                      <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-xs text-green-700 dark:text-green-400">
                        Enabled
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {prompt.content}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(prompt);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void deletePrompt(prompt)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={(event) => void savePrompt(event)}>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit prompt" : "Add prompt"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="prompt-name">Name</Label>
                <Input
                  id="prompt-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Mode</Label>
                <Select
                  value={mode}
                  onValueChange={(value) => setMode(value as typeof mode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="search">Search</SelectItem>
                    <SelectItem value="computer">Computer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prompt-content">Content</Label>
                <textarea
                  id="prompt-content"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  className="min-h-56 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  required
                />
              </div>
              <label
                className="flex items-center justify-between rounded-md border border-border p-3"
                htmlFor="prompt-enabled"
              >
                <span className="text-sm font-medium">Enabled</span>
                <Switch
                  checked={enabled}
                  id="prompt-enabled"
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
