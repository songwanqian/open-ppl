"use client";

import { ArrowRight, History, Monitor, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { SignedOutHero } from "@/components/auth/signed-out-hero";
import { HomeSkeleton } from "@/components/home-skeleton";
import type { SandboxType } from "@/components/sandbox-selector-compact";
import { SessionDrawer } from "@/components/session-drawer";
import { SessionStarter } from "@/components/session-starter";
import { UserAvatarDropdown } from "@/components/user-avatar-dropdown";
import { useSession } from "@/hooks/use-session";
import { useSessions } from "@/hooks/use-sessions";
import type { VercelProjectSelection } from "@/lib/vercel/types";

interface HomePageProps {
  hasSessionCookie: boolean;
  lastRepo: { owner: string; repo: string } | null;
}

export function HomePage({ hasSessionCookie, lastRepo }: HomePageProps) {
  const router = useRouter();
  const { loading: sessionLoading, isAuthenticated } = useSession();
  const { sessions, loading, createSession } = useSessions({
    enabled: isAuthenticated,
  });

  const activeSessionCount = sessions.filter(
    (s) => s.status !== "archived",
  ).length;
  const [isCreating, setIsCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleCreateSession = async (input: {
    mode: "computer" | "search";
    repoOwner?: string;
    repoName?: string;
    branch?: string;
    cloneUrl?: string;
    isNewBranch: boolean;
    sandboxType: SandboxType;
    autoCommitPush: boolean;
    autoCreatePr: boolean;
    vercelProject?: VercelProjectSelection | null;
  }) => {
    setIsCreating(true);
    try {
      const { session: createdSession, chat } = await createSession({
        mode: input.mode,
        repoOwner: input.repoOwner,
        repoName: input.repoName,
        branch: input.branch,
        cloneUrl: input.cloneUrl,
        isNewBranch: input.isNewBranch,
        sandboxType: input.sandboxType,
        autoCommitPush: input.autoCommitPush,
        autoCreatePr: input.autoCreatePr,
        vercelProject: input.vercelProject,
      });

      router.push(`/sessions/${createdSession.id}/chats/${chat.id}`);
    } catch (error) {
      console.error("Failed to create session:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSearchSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery || isCreating) {
      return;
    }

    setIsCreating(true);
    try {
      const { session: createdSession, chat } = await createSession({
        mode: "search",
        title:
          trimmedQuery.length > 80
            ? `${trimmedQuery.slice(0, 80)}...`
            : trimmedQuery,
        isNewBranch: false,
        sandboxType: "vercel",
        autoCommitPush: false,
        autoCreatePr: false,
      });

      const userMessage = {
        id: crypto.randomUUID(),
        role: "user" as const,
        parts: [{ type: "text" as const, text: trimmedQuery }],
      };
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: createdSession.id,
          chatId: chat.id,
          messages: [userMessage],
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Failed to start search");
      }
      await response.body?.cancel();
      router.push(`/sessions/${createdSession.id}/chats/${chat.id}`);
    } catch (error) {
      console.error("Failed to start search:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSessionClick = (sessionId: string) => {
    router.push(`/sessions/${sessionId}`);
  };

  if (sessionLoading && hasSessionCookie) {
    return <HomeSkeleton lastRepo={lastRepo} />;
  }

  if (!isAuthenticated) {
    return <SignedOutHero />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2 sm:justify-self-start">
          <span className="text-lg font-semibold">Open Agents</span>
        </div>
        <div className="flex items-center gap-2 sm:justify-self-end">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {loading ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium tabular-nums text-transparent">
                0
              </span>
            ) : activeSessionCount > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium tabular-nums text-muted-foreground">
                {activeSessionCount}
              </span>
            ) : null}
            <History className="h-4 w-4" />
            <span>Sessions</span>
          </button>
          <UserAvatarDropdown />
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 pt-10 sm:pt-20">
        <div className="w-full max-w-3xl space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-light text-foreground sm:text-4xl">
              What do you want to know?
            </h1>
          </div>

          <form
            onSubmit={(event) => void handleSearchSubmit(event)}
            className="rounded-xl border border-border bg-card p-2 shadow-sm"
          >
            <div className="flex items-end gap-2">
              <Search className="mb-3 ml-2 h-5 w-5 shrink-0 text-muted-foreground" />
              <textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Ask a question, research a topic, compare options..."
                className="min-h-12 flex-1 resize-none bg-transparent px-1 py-3 text-base outline-none placeholder:text-muted-foreground"
                rows={1}
              />
              <Button
                type="submit"
                size="icon"
                className="mb-1 h-10 w-10 shrink-0"
                disabled={!query.trim() || isCreating}
              >
                {isCreating ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>

          <div className="pt-4">
            <div className="mb-3 flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Monitor className="h-3.5 w-3.5" />
              Computer mode
            </div>
            <SessionStarter
              onSubmit={handleCreateSession}
              isLoading={isCreating}
              lastRepo={lastRepo}
            />
          </div>
        </div>
      </main>

      <SessionDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        sessions={sessions}
        loading={loading}
        onSessionClick={handleSessionClick}
      />
    </div>
  );
}
