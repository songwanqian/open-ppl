Summary: Convert Open Agents into a dual-mode Perplexity-style product: a sandbox-backed "Computer" mode for coding/browser-computer work, and a default "Search" mode that is pure chat plus HTTP MCP search/fetch tools running only in Vercel Functions plus Vercel Workflow steps. Keep the existing resumable chat stream, persistence, model selection, and sidebar/session shell as the shared platform.

Context:
- Current architecture is `apps/web` -> `packages/agent` -> `packages/sandbox`, with the primary Computer-mode agent defined in `packages/agent/open-agent.ts`.
- `POST /api/chat` in `apps/web/app/api/chat/route.ts` starts the durable `runAgentWorkflow` in `apps/web/app/workflows/chat.ts`, records `chats.activeStreamId`, and streams chunks back through Workflow's resumable stream.
- The workflow currently always calls `resolveChatSandboxRuntime()` from `apps/web/app/workflows/chat-sandbox-runtime.ts`, which creates or reconnects a Vercel Sandbox before running any assistant turn.
- The UI already consumes AI SDK UI messages through `useSessionChatRuntime()` in `apps/web/app/sessions/[sessionId]/chats/[chatId]/hooks/use-session-chat-runtime.ts`, so a second response engine can reuse the same chat page if it emits compatible `UIMessageChunk`s.
- Sessions are created in `apps/web/app/api/sessions/route.ts` and persisted in `apps/web/lib/db/schema.ts`. There is no explicit session/chat mode today; empty sessions still get `sandboxState: { type: "vercel" }` and `lifecycleState: "provisioning"`.
- Admin settings already have gateway/model sections under `apps/web/app/settings/admin/*`, admin route guards in `apps/web/app/api/admin/*`, and database helpers under `apps/web/lib/db/gateway-*.ts`. New System Prompt and MCP management should follow this pattern.
- Workflow docs for the installed SDK confirm that real work should live in `"use step"` functions, while `"use workflow"` should orchestrate. This matches the requirement that Search mode run in Vercel Function/Workflow, not in Vercel Sandbox.
- AI SDK 6 includes MCP client support through `@ai-sdk/mcp`, including HTTP transport. Search mode should use admin-configured HTTP MCP servers, not provider-native web search.

System Impact:
- Source of truth changes from "every session implies a sandbox-backed agent" to "each session/chat has an execution mode".
- Computer mode continues to own sandbox state, lifecycle, file/diff tabs, git automation, skills, and task delegation.
- Search mode owns pure chat, MCP search, MCP webpage fetching, citations/sources, and answer generation; it must not create, reconnect, refresh, or hibernate a sandbox.
- System Prompt and MCP configuration become admin-owned global runtime configuration. Search sessions read this configuration at workflow step execution time so prompt/tool changes apply to future turns without client changes.
- The chat streaming contract remains `POST /api/chat` -> Workflow run -> `/api/chat/[chatId]/stream`, so client resume, stop, persistence, usage tracking, and sidebar streaming indicators remain shared.
- UI capability flags should derive from mode. Sandbox-only views such as files, diffs, dev server, commit, PR, and lifecycle status should be hidden/disabled for Search mode instead of probing sandbox state.
- Database migrations are required because mode must survive refreshes, background workflows, and future routing. Avoid client-only mode state.

Approach:
- Add an explicit mode model first, then route execution by mode.
- Recommended modes:
  - `computer`: existing sandbox-backed coding/computer workflow.
  - `search`: default research/chat workflow with citations, no sandbox.
- Keep one chat transport and one `/api/chat` endpoint. Add a mode-aware dispatcher inside the workflow layer rather than creating an incompatible second chat system.
- Split workflow internals so `runAgentWorkflow` can delegate to:
  - existing sandbox agent turn for `computer`;
  - new search turn for `search`.
- For Search mode, implement focused step functions that:
  - resolve model runtime using existing preferences/gateway logic;
  - convert UI messages without sandbox tools;
  - load the enabled Search System Prompt from admin configuration;
  - connect only to enabled admin-configured HTTP MCP servers marked for `search` and `web_fetch`;
  - expose MCP tools to the model with clear tool naming/namespace rules;
  - stream text and source/citation chunks;
  - close MCP clients after generation;
  - persist assistant message, usage, workflow run timing, and active-stream cleanup.
- Default product entry should be Search. The home page should be a Perplexity-like first screen centered on a query input, with Computer mode available as an explicit alternate path.

Task List:
- [x] Add `sessions.mode` with `computer`/`search`, default new sessions to `search`, and generate a Drizzle migration.
- [x] Backfill existing sandbox/repo-backed sessions as `computer` in `0038_grey_swordsman.sql`.
- [x] Add admin-owned `system_prompts` and `mcp_servers` tables.
- [x] Add DB helpers for system prompts and MCP servers.
- [x] Enforce exactly one enabled Search system prompt at runtime.
- [x] Add admin-only System Prompt CRUD API routes with payload validation.
- [x] Add admin-only HTTP MCP Server CRUD API routes with public HTTP(S) URL and string-header validation.
- [x] Add MCP server test route that lists tools without executing arbitrary tools.
- [x] Add admin settings navigation items for System Prompts and MCP Servers.
- [x] Build admin prompt editor/list UI.
- [x] Build admin MCP server list/editor/test UI.
- [x] Update session creation to accept and validate `mode`.
- [x] Create Search sessions without `sandboxState` or `lifecycleState: "provisioning"`.
- [x] Preserve existing sandbox provisioning behavior for Computer sessions.
- [x] Expose session-level mode through session creation hooks and components.
- [x] Keep mode session-level and avoid mixed-mode chats for the first release.
- [x] Add mode-aware chat/session capability helpers.
- [x] Dispatch `runAgentWorkflow` by session mode while preserving shared stream lifecycle.
- [x] Keep `chat-sandbox-runtime.ts` Computer-mode-only in practice by ensuring Search dispatch returns before sandbox runtime resolution.
- [x] Add `apps/web/app/workflows/search.ts` with Search-mode model resolution, message conversion, prompt loading, MCP setup, streaming, persistence, usage, and cleanup.
- [x] Add Search system prompt runtime helper.
- [x] Add Search MCP runtime helper with HTTP clients, enabled server filtering, tool namespacing, and reliable client cleanup.
- [x] Use native AI SDK source chunks for citation/source rendering instead of adding custom source parts.
- [x] Render Search sources compactly in chat message UI.
- [x] Hide sandbox-only panels and controls for Search sessions.
- [x] Gate sandbox reconnect/status/lifecycle polling for Search sessions.
- [x] Make the home page Search-first and create/send the initial Search query from the first screen.
- [x] Keep Computer session creation available as the explicit sandbox/repo path.
- [x] Add route tests for creating Search sessions without sandbox state.
- [x] Add admin route tests for prompt and HTTP MCP CRUD/validation.
- [x] Add workflow tests proving Search mode does not call `resolveChatSandboxRuntime`.
- [x] Add Search runtime tests for configured System Prompt loading and enabled MCP tools.
- [x] Add tests for sandbox status/reconnect no-op behavior in Search sessions.
- [x] Update affected package tests for current persistent sandbox connection shape.

Verification:
- [x] Run `bun run --cwd apps/web db:generate` after schema changes and review generated SQL for unrelated drift.
- [x] Run `bun run --cwd apps/web db:check`.
- [x] Run focused session route tests.
- [x] Run focused chat route tests.
- [x] Run focused chat workflow tests.
- [x] Run focused sandbox status/reconnect tests.
- [x] Run focused admin prompt/MCP route tests.
- [x] Run focused Search system prompt/MCP runtime tests.
- [x] Run final required check from the repository root: `bun run ci`.
- [x] Start local dev server for manual verification at `http://localhost:3000`.
- [ ] Configure a Search System Prompt in admin and enable one search MCP plus one web-fetch MCP server.
- [ ] Open the default home page, enter a query, confirm it creates a Search session and starts streaming without sandbox setup status.
- [ ] Confirm the Search response uses MCP search/fetch tools and displays sources/citations.
- [ ] Refresh mid-response and confirm stream resumes through `/api/chat/[chatId]/stream`.
- [ ] Stop a Search response and confirm `activeStreamId` clears.
- [ ] Confirm no sandbox status/reconnect/dev-server/diff/files requests are made for Search sessions.
- [ ] Create a Computer session and confirm existing sandbox setup, coding tools, file/diff UI, lifecycle hibernation, and auto-commit behavior still work.
- [ ] Confirm sidebar unread/streaming indicators work for both modes.

Confirmed Product Decisions:
- Search mode is session-level.
- Search is the default first screen and session mode.
- Search mode is pure chat plus admin-configured HTTP MCP tools for search and webpage fetching.
- Search mode uses the admin-configured Search System Prompt.
- Computer mode remains the sandbox-backed path for Perplexity Computer-like development work.
