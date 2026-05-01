/**
 * Model router -- single entry point for every model call in the app.
 *
 * Priority order:
 *   1. USE_LOCAL_MODELS=true            -> Ollama (local dev, free)
 *   2. LOCAL_TEST=1 + claude CLI         -> Claude Code subscription
 *      AND model starts with 'anthropic/'  (Claude-only; other providers
 *                                           stay on Gateway since Claude Code
 *                                           can't execute them anyway)
 *   3. Claude Code subscription auth     -> AI Gateway via subscription token
 *      via CLAUDECODE=1 + env vars          (dev mode, zero API credit burn)
 *   4. AI_GATEWAY_API_KEY                -> AI Gateway (production default)
 *   5. Unconfigured                      -> throws with actionable error
 *
 * The costMode field returned by resolveModel tags every logAICall record
 * with 'subscription' | 'billable' | 'local' so /dev-kit/cost can split
 * real costs from test costs. When you run `pnpm test:live` with LOCAL_TEST=1
 * set, Claude calls bill against your subscription (free) but OpenAI or
 * Google calls still bill against API keys.
 *
 * Dev-mode env (exported by Claude Code; verify with
 * `env | grep -E 'CLAUDECODE|ANTHROPIC'`):
 *   CLAUDECODE=1
 *   ANTHROPIC_BASE_URL=https://ai-gateway.vercel.sh
 *   ANTHROPIC_AUTH_TOKEN=<gateway-subscription-token>
 *   ANTHROPIC_API_KEY=""        # must be empty or absent; preempts AUTH_TOKEN
 *
 * Local-test env (for running `pnpm test:live` outside Claude Code):
 *   LOCAL_TEST=1                # enables subscription routing for anthropic/*
 *   (claude login)              # must have been run so the CLI is authed
 *
 * Reference: https://vercel.com/docs/agent-resources/coding-agents/claude-code
 */

import { createGateway, type GatewayProvider } from '@ai-sdk/gateway';
import type { LanguageModel } from 'ai';

const isDev = process.env.NODE_ENV === 'development';

export type CostMode = 'subscription' | 'billable' | 'local';

function localModelsEnabled(): boolean {
  return process.env.USE_LOCAL_MODELS === 'true';
}

function hasClaudeCodeAuth(): boolean {
  return (
    process.env.CLAUDECODE === '1' &&
    Boolean(process.env.ANTHROPIC_AUTH_TOKEN) &&
    (process.env.ANTHROPIC_BASE_URL?.includes('ai-gateway.vercel.sh') ?? false) &&
    !process.env.ANTHROPIC_API_KEY
  );
}

function wantLocalTest(): boolean {
  return process.env.LOCAL_TEST === '1';
}

async function importOptionalClaudeCodeProvider(): Promise<unknown | null> {
  const importer = new Function('specifier', 'return import(specifier)') as (
    specifier: string,
  ) => Promise<unknown>;
  return importer('ai-sdk-provider-claude-code').catch(() => null);
}

/** Current auth posture. Used by /api/health and doctor. */
export function authMode(): 'ollama' | 'claude-code' | 'gateway-key' | 'unconfigured' {
  if (localModelsEnabled()) return 'ollama';
  if (isDev && hasClaudeCodeAuth()) return 'claude-code';
  if (process.env.AI_GATEWAY_API_KEY) return 'gateway-key';
  return 'unconfigured';
}

export const gateway: GatewayProvider =
  isDev && hasClaudeCodeAuth()
    ? createGateway({
        apiKey: process.env.ANTHROPIC_AUTH_TOKEN!,
        baseURL: process.env.ANTHROPIC_BASE_URL ?? 'https://ai-gateway.vercel.sh',
      })
    : createGateway({
        apiKey: process.env.AI_GATEWAY_API_KEY,
      });

/**
 * Resolve a model id to a LanguageModel and the cost mode that the call
 * will bill against. Handles the Claude-only LOCAL_TEST subscription
 * routing case. Non-Claude models always fall through to Gateway.
 *
 * The community `ai-sdk-provider-claude-code` package is loaded
 * dynamically ONLY if LOCAL_TEST=1 is set and the model is anthropic/*.
 * Users who don't install that package pay zero import cost and get a
 * clean error pointing at the install command.
 */
export async function resolveModel(modelId: string): Promise<{ model: LanguageModel; costMode: CostMode }> {
  const isAnthropic = modelId.startsWith('anthropic/');

  if (localModelsEnabled()) {
    // TODO: wire Ollama here if the project uses it. For now fall through.
  }

  if (wantLocalTest() && isAnthropic) {
    try {
      const mod = await importOptionalClaudeCodeProvider();
      if (mod && typeof (mod as { claudeCode?: unknown }).claudeCode === 'function') {
        const ccProvider = (mod as { claudeCode: (args?: unknown) => LanguageModel }).claudeCode;
        const bareModel = modelId.replace(/^anthropic\//, '');
        return { model: ccProvider({ model: bareModel }) as LanguageModel, costMode: 'subscription' };
      }
      // Fall through silently -- the community package isn't installed.
      // Log once so the user notices on first call.
      console.warn(
        '[model-router] LOCAL_TEST=1 set but `ai-sdk-provider-claude-code` not installed. ' +
        'Run `pnpm add ai-sdk-provider-claude-code` to enable subscription routing. ' +
        'Falling back to Gateway (billable).',
      );
    } catch {
      // Any load failure falls through to Gateway.
    }
  }

  const isSubscriptionPath = isDev && hasClaudeCodeAuth();
  return {
    model: gateway(modelId),
    costMode: isSubscriptionPath && isAnthropic ? 'subscription' : 'billable',
  };
}

/**
 * Semantic model aliases. Cheap aliases use the current app default LLM.
 *
 * Calibrated against GPT-5.4 Nano, claude-opus-4-6,
 * claude-sonnet-4-5, and gemini-3-flash as of 2026-04-30.
 */
export const models = {
  planner: 'anthropic/claude-opus-4.6',
  generator: 'anthropic/claude-sonnet-4.5',
  evaluator: 'anthropic/claude-sonnet-4.5',
  judge: 'openai/gpt-5.4-nano',
  classifier: 'openai/gpt-5.4-nano',
  bulk: wantLocalTest() ? 'openai/gpt-5.4-nano' : 'google/gemini-3-flash',
} as const;

export type ChatMode = 'fast' | 'smart';
export type ImageMode = 'fast' | 'hq';
