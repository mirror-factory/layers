/**
 * Threshold-based alert dispatcher (PROD-371).
 *
 * Reads metrics from the in-memory event buffer and dispatches Slack-Block-
 * Kit-shaped payloads to ALERT_WEBHOOK_URL when any threshold is breached.
 * If ALERT_WEBHOOK_URL is unset we log `alert.would_fire` instead so the
 * founder can see what would have triggered without spamming a channel.
 *
 * Thresholds reflect the alpha (10 users) -- false-positive cost is high
 * because a real Slack ping at 3am is annoying. We pick numbers that mean
 * "something is structurally wrong" rather than "one user had a bad
 * minute":
 *
 *   - stripe webhook failures > 5/hour
 *       Stripe retries; one bad request is normal noise. >5 = the secret
 *       rotated, the prefix moved, or a route regression.
 *   - recording failures > 3/hour
 *       At 10 users, recording is the core action. Three failures in an
 *       hour = at least one user is broken and probably more.
 *   - auth errors > 50/hour
 *       Auth has a long tail of "wrong password" 4xx that we don't want
 *       to page on. 50 5xx in an hour is a real outage.
 *   - rate-limit hits > 100/hour
 *       PROD-404 limits are 60/minute per client. >100 hits/hour means a
 *       runaway client or a misconfigured retry loop.
 *   - vendor 5xx > 10/hour
 *       A handful of upstream blips are normal; >10 means a vendor is
 *       degraded or our credentials are dead.
 *
 * Uplift path (NOT in scope here, file as follow-up):
 *   - schedule via Vercel Cron every 5 min
 *   - persist last-fired timestamps so we don't re-page on the same hour
 */

import { log } from '../logger';
import { getRecentErrorMetrics, type RecentErrorMetrics } from './event-buffer';

export interface AlertThresholds {
  stripeWebhookFailuresPerHour: number;
  recordingFailuresPerHour: number;
  authErrorsPerHour: number;
  rateLimitHitsPerHour: number;
  vendor5xxPerHour: number;
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  stripeWebhookFailuresPerHour: 5,
  recordingFailuresPerHour: 3,
  authErrorsPerHour: 50,
  rateLimitHitsPerHour: 100,
  vendor5xxPerHour: 10,
};

export interface AlertTrigger {
  metric: keyof RecentErrorMetrics;
  threshold: number;
  observed: number;
  severity: 'warning' | 'critical';
  summary: string;
}

const METRIC_TO_THRESHOLD_KEY: Record<keyof RecentErrorMetrics, keyof AlertThresholds> = {
  stripe_webhook_failures_last_hour: 'stripeWebhookFailuresPerHour',
  recording_failures_last_hour: 'recordingFailuresPerHour',
  auth_errors_last_hour: 'authErrorsPerHour',
  rate_limit_hits_last_hour: 'rateLimitHitsPerHour',
  vendor_500s_last_hour: 'vendor5xxPerHour',
};

const METRIC_SUMMARIES: Record<keyof RecentErrorMetrics, string> = {
  stripe_webhook_failures_last_hour: 'Stripe webhook failure rate above threshold',
  recording_failures_last_hour: 'Recording failure rate above threshold',
  auth_errors_last_hour: 'Auth 5xx rate above threshold',
  rate_limit_hits_last_hour: 'Rate-limit hits above threshold',
  vendor_500s_last_hour: 'Vendor 5xx rate above threshold',
};

export function evaluateAlerts(
  metrics: RecentErrorMetrics = getRecentErrorMetrics(),
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS,
): AlertTrigger[] {
  const triggers: AlertTrigger[] = [];
  for (const metric of Object.keys(METRIC_TO_THRESHOLD_KEY) as Array<keyof RecentErrorMetrics>) {
    const observed = metrics[metric];
    const thresholdKey = METRIC_TO_THRESHOLD_KEY[metric];
    const threshold = thresholds[thresholdKey];
    if (observed > threshold) {
      triggers.push({
        metric,
        threshold,
        observed,
        // Recording + stripe failures are critical (revenue / core flow).
        severity:
          metric === 'stripe_webhook_failures_last_hour' || metric === 'recording_failures_last_hour'
            ? 'critical'
            : 'warning',
        summary: METRIC_SUMMARIES[metric],
      });
    }
  }
  return triggers;
}

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  fields?: Array<{ type: string; text: string }>;
}

export interface SlackBlockKitPayload {
  text: string;          // fallback text for clients that don't render blocks
  blocks: SlackBlock[];
}

export function buildAlertPayload(triggers: AlertTrigger[]): SlackBlockKitPayload {
  const headline = triggers.some(t => t.severity === 'critical')
    ? `CRITICAL: ${triggers.length} alert${triggers.length === 1 ? '' : 's'} firing`
    : `WARNING: ${triggers.length} alert${triggers.length === 1 ? '' : 's'} firing`;

  const fallback = `${headline} -- ${triggers.map(t => `${t.metric}=${t.observed}/${t.threshold}`).join(', ')}`;

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: headline },
    },
    {
      type: 'section',
      fields: triggers.map(t => ({
        type: 'mrkdwn',
        text: `*${t.metric}*\nobserved: \`${t.observed}\` (threshold: \`${t.threshold}\`)\n_${t.summary}_`,
      })),
    },
    {
      type: 'context',
      text: {
        type: 'mrkdwn',
        text: `Window: last 1 hour. Source: in-memory buffer (resets on deploy). See docs/INCIDENT_RUNBOOK.md.`,
      },
    },
  ];

  return { text: fallback, blocks };
}

export interface DispatchResult {
  fired: boolean;
  webhookConfigured: boolean;
  webhookOk?: boolean;
  webhookStatus?: number;
  triggers: AlertTrigger[];
}

/**
 * Dispatch the Slack payload. Pure function over (metrics, thresholds, env).
 * Caller injects `fetchImpl` so tests can assert payload + URL without
 * monkey-patching globalThis.fetch.
 */
export async function dispatchAlerts(opts: {
  metrics?: RecentErrorMetrics;
  thresholds?: AlertThresholds;
  webhookUrl?: string;
  fetchImpl?: typeof fetch;
} = {}): Promise<DispatchResult> {
  const metrics = opts.metrics ?? getRecentErrorMetrics();
  const thresholds = opts.thresholds ?? DEFAULT_THRESHOLDS;
  const webhookUrl = opts.webhookUrl ?? process.env.ALERT_WEBHOOK_URL;
  const triggers = evaluateAlerts(metrics, thresholds);

  if (triggers.length === 0) {
    return { fired: false, webhookConfigured: Boolean(webhookUrl), triggers: [] };
  }

  const payload = buildAlertPayload(triggers);

  if (!webhookUrl) {
    // Founder can see what *would* have fired without burning a real channel.
    log.warn('alert.would_fire', {
      triggers,
      payload,
    });
    return { fired: true, webhookConfigured: false, triggers };
  }

  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5_000),
    });
    log.info('alert.fired', {
      triggers,
      webhookStatus: res.status,
      webhookOk: res.ok,
    });
    return {
      fired: true,
      webhookConfigured: true,
      webhookOk: res.ok,
      webhookStatus: res.status,
      triggers,
    };
  } catch (err) {
    log.error('alert.dispatch_failed', {
      triggers,
      err: err instanceof Error ? { name: err.name, message: err.message } : String(err),
    });
    return {
      fired: true,
      webhookConfigured: true,
      webhookOk: false,
      triggers,
    };
  }
}
