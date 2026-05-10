/**
 * GET /api/dev-kit/config -- list editable project-level DevKit YAML files.
 *
 * The /dev-kit/config editor uses this to seed each tab with current file
 * contents before save/revert actions call /api/dev-kit/config/[name].
 */
import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EDITABLE_CONFIGS } from './files';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const files = EDITABLE_CONFIGS.map((config) => {
      const abs = join(process.cwd(), config.path);
      const exists = existsSync(abs);
      const content = exists ? readFileSync(abs, 'utf-8') : null;

      return {
        slug: config.slug,
        path: config.path,
        label: config.label,
        exists,
        content,
        bytes: content === null ? 0 : Buffer.byteLength(content, 'utf-8'),
      };
    });

    return NextResponse.json({ files });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'read_failed', message },
      { status: 500 },
    );
  }
}
