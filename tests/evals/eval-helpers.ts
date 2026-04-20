/**
 * Eval Test Helpers
 *
 * Utilities for setting up mock models, simulating tool calls, and asserting
 * eval results in Vitest test suites.
 *
 * These helpers are designed to work with the eval-runner scorer types and
 * can be used independently in any AI SDK v6 test file.
 */

import type { ScorerResult } from '../../core/eval-runner';

// ---------------------------------------------------------------------------
// Mock model
// ---------------------------------------------------------------------------

/**
 * Create a mock model that returns predetermined responses in sequence.
 *
 * Each call to `doGenerate` returns the next response from the array.
 * After all responses are exhausted, subsequent calls return the last response.
 *
 * @example
 * ```ts
 * const model = createMockModel(['Hello!', 'How can I help?']);
 * const r1 = await model.doGenerate(opts); // r1.text === 'Hello!'
 * const r2 = await model.doGenerate(opts); // r2.text === 'How can I help?'
 * ```
 */
export function createMockModel(responses: string[]) {
  let callIndex = 0;

  return {
    specificationVersion: 'v1' as const,
    provider: 'mock',
    modelId: 'mock-model',
    defaultObjectGenerationMode: 'json' as const,

    doGenerate: async (options: { prompt: unknown }) => {
      const responseIndex = Math.min(callIndex, responses.length - 1);
      const text = responses[responseIndex] ?? '';
      callIndex++;

      return {
        rawCall: { rawPrompt: options.prompt, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: {
          promptTokens: 10,
          completionTokens: text.length,
        },
        text,
      };
    },

    doStream: async (options: { prompt: unknown }) => {
      const responseIndex = Math.min(callIndex, responses.length - 1);
      const text = responses[responseIndex] ?? '';
      callIndex++;

      return {
        rawCall: { rawPrompt: options.prompt, rawSettings: {} },
        stream: createReadableStream(text),
      };
    },

    /** Reset the call index to replay responses from the beginning. */
    reset() {
      callIndex = 0;
    },

    /** Return how many calls have been made. */
    get callCount() {
      return callIndex;
    },
  };
}

// ---------------------------------------------------------------------------
// Mock stream
// ---------------------------------------------------------------------------

/**
 * Create a mock ReadableStream that emits text in chunks.
 *
 * Simulates streaming responses from an LLM by yielding one chunk at a time.
 *
 * @example
 * ```ts
 * const stream = createMockStream(['Hello', ' world', '!']);
 * for await (const chunk of stream) {
 *   process.stdout.write(chunk.textDelta);
 * }
 * ```
 */
export function createMockStream(chunks: string[]) {
  return createReadableStream(chunks.join(''), chunks);
}

function createReadableStream(fullText: string, chunks?: string[]) {
  const textChunks = chunks ?? [fullText];
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index < textChunks.length) {
        controller.enqueue({
          type: 'text-delta' as const,
          textDelta: textChunks[index],
        });
        index++;
      } else {
        controller.enqueue({
          type: 'finish' as const,
          finishReason: 'stop' as const,
          usage: {
            promptTokens: 10,
            completionTokens: fullText.length,
          },
        });
        controller.close();
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Tool call simulation
// ---------------------------------------------------------------------------

/**
 * Simulate a single tool call and produce a structured result.
 *
 * Returns a string representation matching the format expected by
 * the tool-call scorer.
 *
 * @example
 * ```ts
 * const output = simulateToolCall('search_docs', { query: 'auth' }, { results: [] });
 * // => 'tool_call:search_docs\nArgs: {"query":"auth"}\nResult: {"results":[]}'
 * ```
 */
export function simulateToolCall(
  toolName: string,
  args: Record<string, unknown>,
  result: unknown,
): string {
  const lines = [
    `tool_call:${toolName}`,
    `Args: ${JSON.stringify(args)}`,
    `Result: ${JSON.stringify(result)}`,
  ];
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Multi-step simulation
// ---------------------------------------------------------------------------

interface SimulationStep {
  response: string;
  toolCalls?: Array<{
    name: string;
    args: unknown;
    result: unknown;
  }>;
}

/**
 * Simulate a multi-step agent execution with interleaved text and tool calls.
 *
 * Produces a combined output string representing the full agent trace,
 * suitable for scoring with composite or content scorers.
 *
 * @example
 * ```ts
 * const output = simulateMultiStep([
 *   { response: 'Let me search for that.', toolCalls: [
 *     { name: 'search_docs', args: { query: 'auth' }, result: { docs: ['doc1'] } }
 *   ]},
 *   { response: 'I found one document about authentication.' },
 * ]);
 * ```
 */
export function simulateMultiStep(steps: SimulationStep[]): string {
  const parts: string[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    parts.push(`--- Step ${i + 1} ---`);
    parts.push(step.response);

    if (step.toolCalls && step.toolCalls.length > 0) {
      for (const tc of step.toolCalls) {
        parts.push(simulateToolCall(
          tc.name,
          tc.args as Record<string, unknown>,
          tc.result,
        ));
      }
    }
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Assert that the output contains a tool call to the expected tool.
 *
 * Optionally checks that the expected arguments are present.
 * Returns a ScorerResult for use with the eval framework.
 */
export function assertToolCalled(
  actual: string,
  expectedTool: string,
  expectedArgs?: Record<string, unknown>,
): ScorerResult {
  // Check for tool call indicator
  const toolCallPattern = new RegExp(`tool_call:${expectedTool}`, 'i');
  const toolJsonPattern = new RegExp(`"tool"\\s*:\\s*"${expectedTool}"`, 'i');
  const toolNamePattern = new RegExp(`\\b${expectedTool}\\b`, 'i');

  const toolFound =
    toolCallPattern.test(actual) ||
    toolJsonPattern.test(actual) ||
    toolNamePattern.test(actual);

  if (!toolFound) {
    return {
      pass: false,
      score: 0,
      reason: `Expected tool "${expectedTool}" was not called`,
    };
  }

  if (expectedArgs) {
    const missingArgs: string[] = [];
    for (const [key, value] of Object.entries(expectedArgs)) {
      const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
      if (!actual.includes(key) || !actual.includes(valueStr)) {
        missingArgs.push(key);
      }
    }

    if (missingArgs.length > 0) {
      return {
        pass: false,
        score: 0.5,
        reason: `Tool "${expectedTool}" called but missing args: ${missingArgs.join(', ')}`,
      };
    }
  }

  return {
    pass: true,
    score: 1,
    reason: `Tool "${expectedTool}" called${expectedArgs ? ' with expected args' : ''}`,
  };
}

/**
 * Assert that the output contains all specified keywords (case-insensitive).
 *
 * Returns a ScorerResult with a score proportional to the fraction of
 * keywords found.
 */
export function assertContentContains(
  actual: string,
  keywords: string[],
): ScorerResult {
  if (keywords.length === 0) {
    return { pass: true, score: 1, reason: 'No keywords to check' };
  }

  const lowerActual = actual.toLowerCase();
  const found: string[] = [];
  const missing: string[] = [];

  for (const keyword of keywords) {
    if (lowerActual.includes(keyword.toLowerCase())) {
      found.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  const score = found.length / keywords.length;
  const pass = missing.length === 0;

  return {
    pass,
    score,
    reason: pass
      ? `All ${keywords.length} keywords found`
      : `Missing keywords: ${missing.join(', ')} (found ${found.length}/${keywords.length})`,
  };
}

/**
 * Assert that the response meets length constraints.
 *
 * Checks both minimum and maximum length, returning a ScorerResult.
 */
export function assertResponseQuality(
  actual: string,
  minLength: number,
  maxLength: number,
): ScorerResult {
  const len = actual.length;
  const issues: string[] = [];

  if (len < minLength) {
    issues.push(`Too short: ${len} chars, minimum is ${minLength}`);
  }
  if (len > maxLength) {
    issues.push(`Too long: ${len} chars, maximum is ${maxLength}`);
  }

  if (issues.length === 0) {
    return {
      pass: true,
      score: 1,
      reason: `Response length ${len} is within bounds [${minLength}, ${maxLength}]`,
    };
  }

  // Calculate a proportional score
  let score = 1;
  if (len < minLength) {
    score = minLength > 0 ? Math.max(0, len / minLength) : 0;
  } else if (len > maxLength) {
    score = maxLength > 0 ? Math.max(0, 1 - (len - maxLength) / maxLength) : 0;
  }

  return {
    pass: false,
    score: Math.max(0, Math.min(1, score)),
    reason: issues.join('; '),
  };
}
