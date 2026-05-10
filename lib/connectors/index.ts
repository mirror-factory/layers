export interface ConnectorContract {
  id: string;
  label: string;
  requiredEnv: string[];
  status: 'configured' | 'optional';
}

export const DEFAULT_CONNECTORS: ConnectorContract[] = [
  {
    id: 'supabase',
    label: 'Supabase',
    requiredEnv: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
    status: 'configured',
  },
  {
    id: 'vercel-ai-gateway',
    label: 'Vercel AI Gateway',
    requiredEnv: ['AI_GATEWAY_API_KEY'],
    status: 'configured',
  },
  {
    id: 'resend',
    label: 'Resend',
    requiredEnv: ['RESEND_API_KEY'],
    status: 'optional',
  },
  {
    id: 'stripe',
    label: 'Stripe',
    requiredEnv: ['STRIPE_SECRET_KEY'],
    status: 'optional',
  },
  {
    id: 'linear',
    label: 'Linear',
    requiredEnv: ['LINEAR_API_KEY'],
    status: 'configured',
  },
];
