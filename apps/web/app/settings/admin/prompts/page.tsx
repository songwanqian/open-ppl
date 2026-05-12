import { SystemPromptsSection } from "./system-prompts-section";

export default function AdminPromptsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">System Prompts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the global prompts used by each session mode.
        </p>
      </div>
      <SystemPromptsSection />
    </div>
  );
}
