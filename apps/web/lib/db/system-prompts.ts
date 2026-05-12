import { and, eq, ne } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "./client";
import {
  type NewSystemPrompt,
  type SessionMode,
  type SystemPrompt,
  systemPrompts,
} from "./schema";

type SystemPromptWrite = Omit<
  NewSystemPrompt,
  "id" | "createdAt" | "updatedAt"
>;

export async function getAllSystemPrompts(): Promise<SystemPrompt[]> {
  return db
    .select()
    .from(systemPrompts)
    .orderBy(systemPrompts.mode, systemPrompts.name);
}

export async function getSystemPromptById(
  id: string,
): Promise<SystemPrompt | undefined> {
  const [prompt] = await db
    .select()
    .from(systemPrompts)
    .where(eq(systemPrompts.id, id))
    .limit(1);
  return prompt;
}

export async function getEnabledSystemPromptsByMode(
  mode: SessionMode,
): Promise<SystemPrompt[]> {
  return db
    .select()
    .from(systemPrompts)
    .where(and(eq(systemPrompts.mode, mode), eq(systemPrompts.enabled, true)))
    .orderBy(systemPrompts.updatedAt);
}

export async function getActiveSystemPromptForMode(
  mode: SessionMode,
): Promise<SystemPrompt> {
  const prompts = await getEnabledSystemPromptsByMode(mode);
  if (prompts.length !== 1) {
    throw new Error(
      `Expected exactly one enabled ${mode} system prompt, found ${prompts.length}`,
    );
  }
  const prompt = prompts[0];
  if (!prompt) {
    throw new Error(`No enabled ${mode} system prompt found`);
  }
  return prompt;
}

export async function createSystemPrompt(
  data: SystemPromptWrite,
): Promise<SystemPrompt> {
  return db.transaction(async (tx) => {
    if (data.enabled) {
      await tx
        .update(systemPrompts)
        .set({ enabled: false, updatedAt: new Date() })
        .where(eq(systemPrompts.mode, data.mode));
    }

    const [created] = await tx
      .insert(systemPrompts)
      .values({
        id: nanoid(),
        ...data,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create system prompt");
    }
    return created;
  });
}

export async function updateSystemPrompt(
  id: string,
  data: Partial<SystemPromptWrite>,
): Promise<SystemPrompt | undefined> {
  return db.transaction(async (tx) => {
    const existingRows = await tx
      .select()
      .from(systemPrompts)
      .where(eq(systemPrompts.id, id))
      .limit(1);
    const existing = existingRows[0];
    if (!existing) {
      return undefined;
    }

    const nextMode = data.mode ?? existing.mode;
    if (data.enabled === true) {
      await tx
        .update(systemPrompts)
        .set({ enabled: false, updatedAt: new Date() })
        .where(and(eq(systemPrompts.mode, nextMode), ne(systemPrompts.id, id)));
    }

    const [updated] = await tx
      .update(systemPrompts)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(systemPrompts.id, id))
      .returning();

    return updated;
  });
}

export async function deleteSystemPrompt(id: string): Promise<boolean> {
  const deleted = await db
    .delete(systemPrompts)
    .where(eq(systemPrompts.id, id))
    .returning({ id: systemPrompts.id });
  return deleted.length > 0;
}
