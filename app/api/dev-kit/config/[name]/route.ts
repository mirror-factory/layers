/**
 * POST /api/dev-kit/config/[name] -- write the YAML body for an editable
 * project-level config file from the /dev-kit/config dashboard editor.
 *
 * Security model:
 *   - Auth is handled by middleware-dev-kit.ts (DEV_KIT_DASHBOARD_SECRET).
 *     This route does NOT re-check the token.
 *   - `[name]` MUST match a hardcoded allowlist. Any other slug 404s so an
 *     attacker cannot coax this endpoint into writing arbitrary paths. The
 *     allowlist stays in sync with the GET route at /api/dev-kit/config.
 *   - Body content is lightly sanity-checked (at least one `key:` pair on a
 *     non-comment line; no null bytes) to avoid writing obviously-broken
 *     YAML that would break downstream codegen. Full YAML parsing is not
 *     done on purpose -- we want the editor to be permissive during edits.
 *
 * No queuing, no git commits, no propagation. The warn banner in the UI
 * tells the user to re-run onboard or let the next pre-commit handle
 * downstream regeneration (tokens.css, AGENTS.md, etc.).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getEditableConfig } from '../files';

export const dynamic = 'force-dynamic';

interface PostBody {
  content?: unknown;
  yaml?: unknown;
}

function isPlausibleYaml(src: string): { ok: true } | { ok: false; reason: string } {
  if (src.includes('\u0000')) return { ok: false, reason: 'content contains null byte' };
  let sawKey = false;
  for (const raw of src.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (/^[A-Za-z_][\w.-]*\s*:/.test(line) || /^-\s/.test(line)) {
      sawKey = true;
      break;
    }
  }
  if (!sawKey) return { ok: false, reason: 'no YAML key found on any non-comment line' };
  return { ok: true };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ name: string }> },
): Promise<NextResponse> {
  const { name } = await context.params;
  const config = getEditableConfig(name);
  if (!config) {
    return NextResponse.json(
      { error: 'not_found', message: `unknown config slug: ${name}` },
      { status: 404 },
    );
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json(
      { error: 'invalid_json', message: 'request body is not valid JSON' },
      { status: 400 },
    );
  }

  const content = body.content ?? body.yaml;
  if (typeof content !== 'string') {
    return NextResponse.json(
      { error: 'invalid_body', message: '`content` or `yaml` must be a string' },
      { status: 400 },
    );
  }

  const sanity = isPlausibleYaml(content);
  if (!sanity.ok) {
    return NextResponse.json(
      { error: 'invalid_yaml', message: sanity.reason },
      { status: 400 },
    );
  }

  const abs = join(process.cwd(), config.path);
  try {
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'write_failed', message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    bytes: Buffer.byteLength(content, 'utf-8'),
    path: config.path,
  });
}
