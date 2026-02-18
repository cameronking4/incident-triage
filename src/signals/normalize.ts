import type { IncidentPayload } from "./types";
import { parsePrometheusPayload } from "./prometheus";
import { parsePostHogPayload } from "./posthog";
import { parseDeployPayload } from "./deploy";
import { parseGitHubPayload } from "./github";
import { parseStripePayload } from "./stripe";

export type { IncidentPayload, TriggerKind } from "./types";
export { createIncidentId } from "./types";

export interface NormalizeOptions {
  /** For GitHub webhooks: X-GitHub-Event value */
  githubEvent?: string;
  /** For Prometheus: label filters from config */
  prometheusLabelFilters?: Record<string, string>;
}

/**
 * Route raw payload to the correct parser and return a single IncidentPayload.
 */
export function normalizePayload(
  raw: unknown,
  options: NormalizeOptions = {}
): IncidentPayload | null {
  if (options.githubEvent) {
    return parseGitHubPayload(raw, options.githubEvent);
  }

  if (raw && typeof raw === "object") {
    const body = raw as Record<string, unknown>;
    if (body.version !== undefined && body.alerts !== undefined) {
      return parsePrometheusPayload(raw, options.prometheusLabelFilters);
    }
    if (body.source === "posthog") {
      return parsePostHogPayload(raw);
    }
    if (body.source === "deploy") {
      return parseDeployPayload(raw);
    }
    if (body.object === "event" && typeof body.type === "string" && (body.type as string).includes(".")) {
      return parseStripePayload(raw);
    }
  }

  return null;
}
