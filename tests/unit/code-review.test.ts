/**
 * Tests for code-review sample tool
 *
 * Demonstrates AI Dev Kit test patterns:
 * - Tool output to state (pattern #1)
 * - Error scenarios (pattern #4)
 * - Registry enforcement (pattern #2)
 */

import { describe, it, expect } from 'vitest';
import { codeReview } from './code-review';

describe('code-review tool', () => {
  it('should detect eval() security vulnerability', async () => {
    const result = await codeReview.execute(
      { code: 'const x = eval(userInput);', language: 'typescript' },
      { toolCallId: 'test-1', messages: [] }
    );
    expect(result.critical).toBeGreaterThan(0);
    expect(result.issues.some(i => i.category === 'security')).toBe(true);
  });

  it('should detect any type usage', async () => {
    const result = await codeReview.execute(
      { code: 'function process(data: any) { return data; }', language: 'typescript' },
      { toolCallId: 'test-2', messages: [] }
    );
    expect(result.warnings).toBeGreaterThan(0);
  });

  it('should handle clean code with no issues', async () => {
    const result = await codeReview.execute(
      { code: '// Simple function\nconst add = (a: number, b: number): number => a + b;', language: 'typescript' },
      { toolCallId: 'test-3', messages: [] }
    );
    expect(result.totalIssues).toBe(0);
  });

  it('should respect focusAreas filter', async () => {
    const result = await codeReview.execute(
      { code: 'const x = eval("test"); const y: any = 1;', language: 'typescript', focusAreas: ['security'] },
      { toolCallId: 'test-4', messages: [] }
    );
    expect(result.focusAreas).toContain('security');
  });

  it('should include metadata in response', async () => {
    const result = await codeReview.execute(
      { code: 'console.log("hello");', language: 'javascript' },
      { toolCallId: 'test-5', messages: [] }
    );
    expect(result.language).toBe('javascript');
    expect(result.reviewedAt).toBeDefined();
  });
});
