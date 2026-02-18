import { z } from "zod";

const signalsSchema = z.object({
  prometheus: z
    .object({
      enabled: z.boolean().default(true),
      labelFilters: z.record(z.string()).optional(),
    })
    .default({}),
  posthog: z
    .object({
      enabled: z.boolean().default(false),
      funnelDropThreshold: z.number().min(0).max(1).optional(),
    })
    .default({}),
  deploy: z
    .object({
      enabled: z.boolean().default(true),
      providers: z.array(z.string()).optional(),
    })
    .default({}),
  github: z
    .object({
      enabled: z.boolean().default(true),
      events: z
        .array(z.enum(["deployment_status", "check_run", "workflow_run"]))
        .optional()
        .default(["deployment_status", "check_run", "workflow_run"]),
    })
    .default({}),
  stripe: z
    .object({
      enabled: z.boolean().default(false),
      events: z.array(z.string()).optional(),
    })
    .default({}),
});

const serviceSchema = z.object({
  name: z.string().min(1),
  repo: z.string().min(1),
  paths: z.array(z.string().min(1)).optional().default([]),
});

const normalizerSchema = z.object({
  timeWindowMinutes: z.number().int().positive().default(30),
  commitDepth: z.number().int().positive().default(10),
  logsAdapter: z.enum(["file"]).default("file"),
  dashboards: z
    .object({
      urlTemplate: z.string().optional(),
    })
    .optional(),
});

const outputsSchema = z.object({
  createPatchPr: z.boolean().default(false),
  createTelemetryPr: z.boolean().default(false),
  requireHumanReview: z.boolean().default(true),
  reportPath: z.string().default(".incident-triage/reports"),
});

export const incidentTriageConfigSchema = z.object({
  version: z.literal(1),
  devin: z.object({
    apiVersion: z.literal("v1"),
    unlisted: z.boolean().default(true),
    maxAcuLimit: z.number().int().positive().default(3),
    tags: z.array(z.string().min(1)).default(["incident-triage"]),
  }),
  signals: signalsSchema.default({}),
  services: z.array(serviceSchema).default([]),
  normalizer: normalizerSchema.default({}),
  outputs: outputsSchema.default({}),
});

export type IncidentTriageConfig = z.infer<typeof incidentTriageConfigSchema>;
export type ServiceConfig = z.infer<typeof serviceSchema>;
