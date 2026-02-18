import type { IncidentPayload } from "./types";
import { createIncidentId } from "./types";

interface StripeEventPayload {
  id?: string;
  object?: string;
  type?: string;
  created?: number;
  data?: {
    object?: Record<string, unknown>;
  };
}

/**
 * Parse Stripe webhook event.
 * Triggers on any event whose `object` is `"event"` and `type` is a dotted Stripe event name.
 */
export function parseStripePayload(raw: unknown): IncidentPayload | null {
  const body = raw as StripeEventPayload;
  if (!body || typeof body !== "object") return null;
  if (String(body.object) !== "event") return null;
  if (!body.type || !body.type.includes(".")) return null;

  const labels: Record<string, string> = {
    event_type: String(body.type),
  };
  if (body.id) labels.event_id = String(body.id);

  const dataObj = body.data?.object;
  if (dataObj) {
    if (typeof dataObj.id === "string") labels.resource_id = dataObj.id;
    if (typeof dataObj.status === "string") labels.status = dataObj.status;
    if (typeof dataObj.customer === "string") labels.customer = dataObj.customer;
    if (typeof dataObj.amount === "number") labels.amount = String(dataObj.amount);
    if (typeof dataObj.currency === "string") labels.currency = dataObj.currency;
  }

  const startsAt =
    typeof body.created === "number"
      ? new Date(body.created * 1000).toISOString()
      : new Date().toISOString();

  return {
    id: createIncidentId(),
    trigger: "stripe",
    startsAt,
    labels,
    annotations: {},
    raw,
  };
}
