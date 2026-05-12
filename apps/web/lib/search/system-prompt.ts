import { getActiveSystemPromptForMode } from "@/lib/db/system-prompts";

export async function loadSearchSystemPrompt(): Promise<string> {
  const prompt = await getActiveSystemPromptForMode("search");
  return prompt.content;
}
