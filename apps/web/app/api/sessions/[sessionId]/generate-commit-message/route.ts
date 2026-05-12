import { connectSandbox } from "@open-agents/sandbox";
import { gateway } from "@open-agents/agent";
import { generateText } from "ai";
import { checkBotProtection } from "@/lib/botid";
import { getSessionById } from "@/lib/db/sessions";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { SYSTEM_FAST_MODEL_ID } from "@/lib/models";
import { resolveGatewayConfig } from "@/lib/resolve-gateway-config";
import { isSandboxActive } from "@/lib/sandbox/utils";
import { getServerSession } from "@/lib/session/get-server-session";

export const maxDuration = 30;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await getServerSession();
  if (!session?.user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const botVerification = await checkBotProtection();
  if (botVerification.isBot) {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }

  const limited = await checkRateLimit({
    key: rateLimitKey(["generate-commit-message", session.user.id]),
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) {
    return limited;
  }

  const { sessionId } = await params;
  const dbSession = await getSessionById(sessionId);
  if (!dbSession || dbSession.userId !== session.user.id) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  if (!isSandboxActive(dbSession.sandboxState)) {
    return Response.json({ error: "No active sandbox" }, { status: 400 });
  }

  const sandbox = await connectSandbox(dbSession.sandboxState);
  const cwd = sandbox.workingDirectory;

  // Get the diff for commit message generation
  const diffResult = await sandbox.exec(
    "git diff HEAD --stat && echo '---DIFF---' && git diff HEAD",
    cwd,
    30000,
  );

  const diff = diffResult.stdout;
  if (!diff.trim() || !diff.includes("---DIFF---")) {
    return Response.json({ message: "chore: update repository changes" });
  }

  let generated: string | undefined;
  try {
    const result = await generateText({
      model: gateway(SYSTEM_FAST_MODEL_ID, {
        config: await resolveGatewayConfig(SYSTEM_FAST_MODEL_ID),
      }),
      prompt: `Generate a concise git commit message for these changes. Use conventional commit format (e.g., "feat:", "fix:", "refactor:"). One line only, max 72 characters.

Session context: ${dbSession.title}

Diff:
${diff.slice(0, 8000)}

Respond with ONLY the commit message, nothing else.`,
    });
    generated = result.text.trim().split("\n")[0]?.trim();
  } catch (error) {
    console.error("[generate-commit-message] LLM call failed:", error);
  }

  const message =
    generated && generated.length > 0
      ? generated.slice(0, 72)
      : "chore: update repository changes";

  return Response.json({ message });
}
