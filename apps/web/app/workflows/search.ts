import {
  convertToModelMessages,
  generateId as generateIdAi,
  type FinishReason,
  type LanguageModelUsage,
  type ModelMessage,
  pruneMessages,
  stepCountIs,
  streamText,
  type UIMessageChunk,
} from "ai";
import { gateway } from "@open-agents/agent";
import { getRun } from "workflow/api";
import type {
  WebAgentMessageMetadata,
  WebAgentStepFinishMetadata,
  WebAgentUIMessage,
} from "@/app/types";
import { dedupeMessageReasoning } from "@/lib/chat/dedupe-message-reasoning";
import { getChatById, getSessionById } from "@/lib/db/sessions";
import { getUserPreferences } from "@/lib/db/user-preferences";
import {
  filterModelVariantsForSession,
  sanitizeSelectedModelIdForSession,
  sanitizeUserPreferencesForSession,
} from "@/lib/model-access";
import { getAllVariantsAsync } from "@/lib/model-variants-server";
import { APP_DEFAULT_MODEL_ID } from "@/lib/models";
import type { Session as AuthSession } from "@/lib/session/types";
import {
  closeSearchMcpRuntime,
  createSearchMcpRuntime,
} from "@/lib/search/mcp-runtime";
import { loadSearchSystemPrompt } from "@/lib/search/system-prompt";
import { resolveChatModelSelectionWithGateway } from "../api/chat/_lib/model-selection";
import {
  clearActiveStream,
  closeStream,
  persistAssistantMessage,
  persistAssistantMessageWithToolResults,
  persistUserMessage,
  recordWorkflowUsage,
  sendFinish,
} from "./chat-post-finish";
import { extractGatewayCost } from "./gateway-metadata";
import { addLanguageModelUsage } from "./usage-utils";
import type {
  WorkflowRunStatus,
  WorkflowRunStepTiming,
} from "@/lib/db/workflow-runs";

type AuthSessionContext = Pick<AuthSession, "authProvider" | "user"> | null;

export type SearchWorkflowOptions = {
  messages: WebAgentUIMessage[];
  chatId: string;
  sessionId: string;
  userId: string;
  requestUrl: string;
  authSession: AuthSessionContext;
  maxSteps?: number;
};

type Writable = WritableStream<UIMessageChunk>;

type SearchModelRuntime = {
  selectedModelId: string;
  modelId: string;
  model: Awaited<ReturnType<typeof resolveChatModelSelectionWithGateway>>;
};

type SearchStepResult = {
  responseMessage: WebAgentUIMessage | undefined;
  responseMessages: ModelMessage[];
  finishReason: FinishReason;
  rawFinishReason?: string;
  usage?: LanguageModelUsage;
  wasAborted: boolean;
  stepTiming: WorkflowRunStepTiming;
};

const convertSearchMessages = async (
  messages: WebAgentUIMessage[],
): Promise<ModelMessage[]> => {
  "use step";
  const dedupedMessages = messages.map(dedupeMessageReasoning);
  const modelMessages = await convertToModelMessages<WebAgentUIMessage>(
    dedupedMessages,
    {
      ignoreIncompleteToolCalls: true,
      convertDataPart: (part) => {
        if (part.type === "data-snippet") {
          const { filename, content } = part.data;
          return {
            type: "text",
            text: JSON.stringify({ type: "snippet", filename, content }),
          };
        }
        return undefined;
      },
    },
  );

  return pruneMessages({
    messages: modelMessages,
    emptyMessages: "remove",
  });
};

async function resolveSearchModelRuntime(params: {
  userId: string;
  sessionId: string;
  chatId: string;
  requestUrl: string;
  authSession: AuthSessionContext;
}): Promise<SearchModelRuntime> {
  "use step";

  const [sessionRecord, chat, rawPreferences] = await Promise.all([
    getSessionById(params.sessionId),
    getChatById(params.chatId),
    getUserPreferences(params.userId).catch((error) => {
      console.error("Failed to load user preferences:", error);
      return null;
    }),
  ]);

  if (!sessionRecord) {
    throw new Error("Session not found");
  }
  if (sessionRecord.userId !== params.userId) {
    throw new Error("Unauthorized");
  }
  if (sessionRecord.mode !== "search") {
    throw new Error("Search workflow requires a search session");
  }
  if (!chat || chat.sessionId !== params.sessionId) {
    throw new Error("Chat not found");
  }

  const preferences = rawPreferences
    ? await sanitizeUserPreferencesForSession(
        rawPreferences,
        params.authSession,
        params.requestUrl,
      )
    : null;
  const modelVariants = filterModelVariantsForSession(
    await getAllVariantsAsync(preferences?.modelVariants ?? []),
    params.authSession,
    params.requestUrl,
  );
  const selectedModelId =
    sanitizeSelectedModelIdForSession(
      chat.modelId,
      modelVariants,
      params.authSession,
      params.requestUrl,
    ) ??
    chat.modelId ??
    null;
  const model = await resolveChatModelSelectionWithGateway({
    selectedModelId,
    modelVariants,
    missingVariantLabel: "Selected model variant",
  });

  return {
    selectedModelId: selectedModelId ?? model.id,
    modelId: model.id,
    model,
  };
}

const generateId = async () => {
  "use step";
  return generateIdAi();
};

async function persistInputMessages(
  chatId: string,
  messages: WebAgentUIMessage[],
): Promise<void> {
  "use step";

  const latestMessage = messages[messages.length - 1];
  if (!latestMessage) {
    return;
  }

  await Promise.all([
    persistUserMessage(chatId, latestMessage),
    persistAssistantMessageWithToolResults(chatId, latestMessage),
  ]);
}

function withModelMetadata(
  metadata: WebAgentMessageMetadata | undefined,
  selectedModelId: string,
  modelId: string,
): WebAgentMessageMetadata {
  return {
    ...metadata,
    selectedModelId,
    modelId,
  };
}

function buildStepTiming(
  stepNumber: number,
  startedAt: Date,
  finishedAt: Date,
  finishReason?: string,
  rawFinishReason?: string,
): WorkflowRunStepTiming {
  return {
    stepNumber,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    finishReason,
    rawFinishReason,
  };
}

function getSearchErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Search failed. Try again in a moment.";
  }
  if (error.message.includes("system prompt")) {
    return "Search is not configured yet. Add one enabled Search system prompt in admin settings.";
  }
  if (error.message.includes("MCP") || error.message.includes("mcp")) {
    return "Search tools are unavailable. Check the enabled MCP server configuration.";
  }
  return "Search failed. Try again in a moment.";
}

export async function runSearchWorkflowTurn(
  options: SearchWorkflowOptions & {
    workflowRunId: string;
    writable: Writable;
  },
) {
  const latestMessage = options.messages.at(-1);
  if (latestMessage == null) {
    throw new Error("runSearchWorkflowTurn requires at least one message");
  }

  const modelMessagesPromise = convertSearchMessages(options.messages);
  const inputMessagesPersistPromise = persistInputMessages(
    options.chatId,
    options.messages,
  );
  const assistantId =
    latestMessage.role === "assistant" ? latestMessage.id : await generateId();
  let selectedModelId = APP_DEFAULT_MODEL_ID;
  let modelId = APP_DEFAULT_MODEL_ID;

  let pendingAssistantResponse: WebAgentUIMessage =
    latestMessage.role === "assistant"
      ? {
          ...latestMessage,
          metadata: withModelMetadata(
            latestMessage.metadata,
            selectedModelId,
            modelId,
          ),
          parts: [...latestMessage.parts],
        }
      : {
          role: "assistant",
          id: assistantId,
          parts: [],
          metadata: withModelMetadata(undefined, selectedModelId, modelId),
        };

  const runStartedAt = new Date();
  const previousResponseMessage =
    latestMessage.role === "assistant" ? latestMessage : undefined;
  const stepTimings: WorkflowRunStepTiming[] = [];
  let totalUsage: LanguageModelUsage | undefined;
  let workflowStatus: WorkflowRunStatus = "completed";
  let caughtError: unknown;
  let streamClosed = false;

  try {
    const [modelRuntime, modelMessages] = await Promise.all([
      resolveSearchModelRuntime({
        userId: options.userId,
        sessionId: options.sessionId,
        chatId: options.chatId,
        requestUrl: options.requestUrl,
        authSession: options.authSession,
      }),
      modelMessagesPromise,
      inputMessagesPersistPromise,
    ]);
    selectedModelId = modelRuntime.selectedModelId;
    modelId = modelRuntime.modelId;
    pendingAssistantResponse = {
      ...pendingAssistantResponse,
      metadata: withModelMetadata(
        pendingAssistantResponse.metadata,
        selectedModelId,
        modelId,
      ),
    };

    const result = await runSearchStep({
      modelMessages,
      originalMessages: [latestMessage],
      messageId: assistantId,
      writable: options.writable,
      workflowRunId: options.workflowRunId,
      selectedModelId,
      modelId,
      model: modelRuntime.model,
      maxSteps: options.maxSteps ?? 12,
    });

    stepTimings.push(result.stepTiming);
    pendingAssistantResponse =
      result.responseMessage ?? pendingAssistantResponse;
    if (result.usage) {
      totalUsage = totalUsage
        ? addLanguageModelUsage(totalUsage, result.usage)
        : result.usage;
      pendingAssistantResponse = {
        ...pendingAssistantResponse,
        metadata: {
          ...pendingAssistantResponse.metadata,
          totalMessageUsage: totalUsage,
        },
      };
    }

    await persistAssistantMessage(options.chatId, pendingAssistantResponse);
    await Promise.all([
      clearActiveStream(options.chatId, options.workflowRunId),
      sendFinish(options.writable).then(() => closeStream(options.writable)),
    ]);
    streamClosed = true;
    workflowStatus = result.wasAborted ? "aborted" : "completed";
  } catch (error) {
    workflowStatus = "failed";
    caughtError = error;

    if (!streamClosed) {
      const errorText = getSearchErrorMessage(error);
      pendingAssistantResponse = {
        ...pendingAssistantResponse,
        parts:
          pendingAssistantResponse.parts.length === 0
            ? [{ type: "text", text: errorText }]
            : [
                ...pendingAssistantResponse.parts,
                { type: "text", text: `\n\n${errorText}` },
              ],
      };
      await sendTextMessage(
        options.writable,
        `${assistantId}:search-error`,
        errorText,
      );
      await persistAssistantMessage(options.chatId, pendingAssistantResponse);
    }
  } finally {
    try {
      if (!streamClosed) {
        await Promise.all([
          clearActiveStream(options.chatId, options.workflowRunId),
          sendFinish(options.writable).then(() =>
            closeStream(options.writable),
          ),
        ]);
      }
    } finally {
      const runFinishedAt = new Date();
      await recordWorkflowUsage(
        options.userId,
        modelId,
        totalUsage,
        pendingAssistantResponse,
        previousResponseMessage,
        {
          workflowRunId: options.workflowRunId,
          chatId: options.chatId,
          sessionId: options.sessionId,
          status: workflowStatus,
          startedAt: runStartedAt.toISOString(),
          finishedAt: runFinishedAt.toISOString(),
          totalDurationMs: runFinishedAt.getTime() - runStartedAt.getTime(),
          stepTimings,
        },
      );
    }
  }

  if (caughtError) {
    throw caughtError;
  }
}

async function runSearchStep(params: {
  modelMessages: ModelMessage[];
  originalMessages: WebAgentUIMessage[];
  messageId: string;
  writable: Writable;
  workflowRunId: string;
  selectedModelId: string;
  modelId: string;
  model: SearchModelRuntime["model"];
  maxSteps: number;
}): Promise<SearchStepResult> {
  "use step";

  const stepStartedAt = new Date();
  const abortController = new AbortController();
  const stopMonitor = startStopMonitor(params.workflowRunId, abortController);
  const mcpRuntime = await createSearchMcpRuntime();

  try {
    const system = await loadSearchSystemPrompt();
    let responseMessage: WebAgentUIMessage | undefined;
    let lastStepUsage: LanguageModelUsage | undefined;
    let lastStepCost: number | undefined;
    const lastOriginalMessage = params.originalMessages.at(-1);
    const existingStepFinishReasons: WebAgentStepFinishMetadata[] =
      lastOriginalMessage?.role === "assistant"
        ? [...(lastOriginalMessage.metadata?.stepFinishReasons ?? [])]
        : [];
    const existingTotalMessageUsage =
      lastOriginalMessage?.role === "assistant"
        ? lastOriginalMessage.metadata?.totalMessageUsage
        : undefined;
    const existingTotalMessageCost =
      lastOriginalMessage?.role === "assistant"
        ? lastOriginalMessage.metadata?.totalMessageCost
        : undefined;
    let stepFinishReasons = existingStepFinishReasons;
    let totalMessageUsage = existingTotalMessageUsage;
    let totalMessageCost = existingTotalMessageCost;

    const result = streamText({
      model: gateway(params.model.id, { config: params.model.gatewayConfig }),
      system,
      messages: params.modelMessages,
      tools: mcpRuntime.tools,
      stopWhen: stepCountIs(params.maxSteps),
      abortSignal: abortController.signal,
    });

    for await (const part of result.toUIMessageStream<WebAgentUIMessage>({
      originalMessages: params.originalMessages,
      generateMessageId: () => params.messageId,
      sendStart: false,
      sendFinish: false,
      sendSources: true,
      messageMetadata: ({ part: streamPart }) => {
        if (streamPart.type === "finish-step") {
          lastStepUsage = streamPart.usage;
          if (streamPart.usage) {
            totalMessageUsage = totalMessageUsage
              ? addLanguageModelUsage(totalMessageUsage, streamPart.usage)
              : streamPart.usage;
          }
          const stepCost = extractGatewayCost(streamPart.providerMetadata);
          if (stepCost !== undefined) {
            lastStepCost = stepCost;
            totalMessageCost = (totalMessageCost ?? 0) + stepCost;
          }
          stepFinishReasons = [
            ...stepFinishReasons,
            {
              finishReason: streamPart.finishReason,
              rawFinishReason: streamPart.rawFinishReason,
            },
          ];
          return {
            selectedModelId: params.selectedModelId,
            modelId: params.modelId,
            lastStepUsage,
            totalMessageUsage,
            lastStepCost,
            totalMessageCost,
            lastStepFinishReason: streamPart.finishReason,
            lastStepRawFinishReason: streamPart.rawFinishReason,
            stepFinishReasons,
          } satisfies WebAgentMessageMetadata;
        }
        return undefined;
      },
      onFinish: ({ responseMessage: finishedResponseMessage }) => {
        responseMessage = finishedResponseMessage;
      },
    })) {
      const writer = params.writable.getWriter();
      try {
        await writer.write(part);
      } finally {
        writer.releaseLock();
      }
    }

    if (responseMessage == null) {
      throw new Error("Search stream finished without a response message");
    }

    const [usage, finishReason, rawFinishReason, response] = await Promise.all([
      result.totalUsage,
      result.finishReason,
      result.rawFinishReason,
      result.response,
    ]);

    responseMessage = {
      ...responseMessage,
      metadata: {
        ...withModelMetadata(
          responseMessage.metadata,
          params.selectedModelId,
          params.modelId,
        ),
        totalMessageUsage: existingTotalMessageUsage
          ? addLanguageModelUsage(existingTotalMessageUsage, usage)
          : usage,
      },
    };

    const stepFinishedAt = new Date();
    return {
      responseMessage,
      responseMessages: response.messages,
      finishReason,
      rawFinishReason,
      usage,
      wasAborted: false,
      stepTiming: buildStepTiming(
        1,
        stepStartedAt,
        stepFinishedAt,
        finishReason,
        rawFinishReason,
      ),
    };
  } catch (error) {
    const stepFinishedAt = new Date();

    if (isAbortError(error)) {
      const abortedFinishReason: FinishReason = "stop";
      return {
        responseMessage: undefined,
        responseMessages: [],
        finishReason: abortedFinishReason,
        rawFinishReason: undefined,
        usage: undefined,
        wasAborted: true,
        stepTiming: buildStepTiming(
          1,
          stepStartedAt,
          stepFinishedAt,
          abortedFinishReason,
        ),
      };
    }

    throw error;
  } finally {
    await closeSearchMcpRuntime(mcpRuntime);
    stopMonitor.stop();
    await stopMonitor.done;
  }
}

function startStopMonitor(runId: string, abortController: AbortController) {
  let shouldStop = false;

  const done = (async () => {
    const run = getRun(runId);

    while (!shouldStop && !abortController.signal.aborted) {
      let runStatus:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "cancelled";

      try {
        runStatus = await run.status;
      } catch {
        await delay(150);
        continue;
      }

      if (runStatus === "cancelled") {
        abortController.abort();
        return;
      }

      await delay(150);
    }
  })();

  return {
    stop() {
      shouldStop = true;
    },
    done,
  };
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

async function sendTextMessage(writable: Writable, id: string, text: string) {
  "use step";
  const writer = writable.getWriter();
  try {
    await writer.write({ type: "text-start", id });
    await writer.write({ type: "text-delta", id, delta: text });
    await writer.write({ type: "text-end", id });
  } finally {
    writer.releaseLock();
  }
}
