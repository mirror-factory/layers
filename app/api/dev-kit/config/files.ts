export interface EditableConfig {
  slug: string;
  path: string;
  label: string;
}

export const EDITABLE_CONFIGS: readonly EditableConfig[] = [
  { slug: 'design-tokens', path: '.ai-dev-kit/registries/design-tokens.yaml', label: 'Design tokens' },
  { slug: 'design-system', path: '.ai-dev-kit/registries/design-system.yaml', label: 'Design system' },
  { slug: 'budget', path: '.ai-dev-kit/budget.yaml', label: 'Budget' },
  { slug: 'notify', path: '.ai-dev-kit/notify.yaml', label: 'Notify' },
  { slug: 'observability', path: '.ai-dev-kit/observability-requirements.yaml', label: 'Observability' },
  { slug: 'requirements', path: '.ai-dev-kit/requirements.yaml', label: 'Requirements' },
] as const;

export function getEditableConfig(slug: string): EditableConfig | undefined {
  return EDITABLE_CONFIGS.find((config) => config.slug === slug);
}
