export type TriggerKind = "prometheus" | "posthog" | "deploy" | "github" | "stripe";

export interface IncidentPayload {
  id: string;
  trigger: TriggerKind;
  startsAt: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  raw: unknown;
}

export function createIncidentId(): string {
  return `inc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
