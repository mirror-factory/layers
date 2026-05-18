"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Check, ChevronDown, BellRing } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { RecordingReminderPanel } from "@/components/recording-reminder";
import { IntegrationsSettingsPanel } from "@/components/integrations-settings-panel";
import {
  DEFAULTS,
  MODEL_OPTIONS,
  type ModelSettings,
} from "@/lib/settings-shared";

export default function SettingsPage() {
  const [settings, setSettings] = useState<ModelSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setSettings(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(
    async (patch: Partial<ModelSettings>) => {
      const merged = { ...settings, ...patch };
      setSettings(merged);
      setSaving(true);
      setSaved(false);

      try {
        await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch {
        // best-effort
      } finally {
        setSaving(false);
      }
    },
    [settings],
  );

  if (loading) {
    return (
      <div className="paper-calm-page min-h-screen-safe flex flex-col bg-[var(--bg-primary)]">
        <TopBar title="Settings" showBack />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="text-layers-mint animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="paper-calm-page min-h-screen-safe flex flex-col bg-[var(--bg-primary)]">
      <TopBar title="Settings" showBack />

      <main className="flex-1 px-4 pb-safe py-6 max-w-xl mx-auto w-full space-y-8">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Model Preferences
          </h2>
          {saving && (
            <Loader2 size={14} className="text-layers-mint animate-spin" />
          )}
          {saved && <Check size={14} className="text-signal-success" />}
        </div>

        {/* Summary Model */}
        <SelectGroup
          label="Summary / Intake Model"
          description="LLM used for meeting summary and intake extraction"
          value={settings.summaryModel}
          options={MODEL_OPTIONS.summary}
          onChange={(v) => save({ summaryModel: v })}
        />

        {/* Batch Speech Model */}
        <SelectGroup
          label="Batch Speech Model"
          description="Runtime model for pre-recorded audio. Provider switching is modeled in Pricing Admin until adapters are wired."
          value={settings.batchSpeechModel}
          options={MODEL_OPTIONS.batchSpeech}
          onChange={(v) => save({ batchSpeechModel: v })}
        />

        {/* Streaming Speech Model */}
        <SelectGroup
          label="Streaming Speech Model"
          description="Runtime model for real-time transcription. Deepgram requires DEEPGRAM_API_KEY."
          value={settings.streamingSpeechModel}
          options={MODEL_OPTIONS.streamingSpeech}
          onChange={(v) => save({ streamingSpeechModel: v })}
        />

        <ReminderSettingsPanel />

        <IntegrationsSettingsPanel />
      </main>
    </div>
  );
}

function ReminderSettingsPanel() {
  return (
    <section id="recording-reminders" className="glass-card rounded-xl p-4">
      <div className="flex items-start gap-3">
        <span className="settings-reminder-icon" aria-hidden="true">
          <BellRing size={17} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Recording Reminders
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            Schedule recording nudges here so the capture screen stays focused
            on one action.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <RecordingReminderPanel upcomingEvent={null} />
      </div>
    </section>
  );
}

interface SelectGroupProps {
  label: string;
  description: string;
  value: string;
  options: readonly { value: string; label: string; price: string }[];
  onChange: (value: string) => void;
}

function SelectGroup({
  label,
  description,
  value,
  options,
  onChange,
}: SelectGroupProps) {
  const selected = options.find((opt) => opt.value === value);

  return (
    <div className="glass-card rounded-xl p-4 settings-option-group">
      <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
        {label}
      </label>
      <p className="text-xs leading-5 text-[var(--text-muted)] mb-3">
        {description}
      </p>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="settings-select signal-input min-h-[48px] w-full cursor-pointer appearance-none rounded-lg py-3 pl-3 pr-10 text-sm font-medium text-[var(--text-primary)] transition-colors duration-200 focus:outline-none"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          aria-hidden="true"
        />
      </div>
      {selected && (
        <div className="settings-selected-details mt-3 rounded-lg border border-[var(--border-card)] bg-[var(--surface-control)] px-3 py-2.5">
          <div className="text-xs font-medium leading-5 text-[var(--text-secondary)]">
            {selected.label}
          </div>
          <div className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">
            {selected.price}
          </div>
        </div>
      )}
    </div>
  );
}
