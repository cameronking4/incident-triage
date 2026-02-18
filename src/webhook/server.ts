import http from "node:http";
import { runTriage, normalizePayload } from "../index";

function parseBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(
  res: http.ServerResponse,
  statusCode: number,
  body: string,
  contentType = "text/plain"
): void {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function runTriageAsync(payload: unknown, githubEvent?: string): void {
  setImmediate(async () => {
    try {
      const incident = normalizePayload(payload, {
        githubEvent,
        prometheusLabelFilters: undefined,
      });
      if (!incident) {
        console.error("Webhook: could not parse payload");
        return;
      }
      const apiKey = process.env.DEVIN_API_KEY;
      if (!apiKey) {
        console.error("Webhook: DEVIN_API_KEY not set");
        return;
      }
      await runTriage(incident, apiKey);
      console.log("Webhook: triage completed for", incident.id);
    } catch (err) {
      console.error("Webhook: triage failed", err);
    }
  });
}

export function startWebhookServer(port: number): void {
  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST") {
      send(res, 405, "Method Not Allowed");
      return;
    }

    const url = req.url ?? "";
    const body = await parseBody(req);

    if (url === "/webhook/prometheus") {
      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        send(res, 400, "Invalid JSON");
        return;
      }
      const incident = normalizePayload(payload, {
        prometheusLabelFilters: undefined,
      });
      if (!incident) {
        send(res, 400, "No firing alerts or filter mismatch");
        return;
      }
      send(res, 200, "OK");
      runTriageAsync(payload);
      return;
    }

    if (url === "/webhook/deploy") {
      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        send(res, 400, "Invalid JSON");
        return;
      }
      const incident = normalizePayload(payload);
      if (!incident) {
        send(res, 400, "Invalid deploy payload (expected source: deploy)");
        return;
      }
      send(res, 200, "OK");
      runTriageAsync(payload);
      return;
    }

    if (url === "/webhook/posthog") {
      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        send(res, 400, "Invalid JSON");
        return;
      }
      const incident = normalizePayload(payload);
      if (!incident) {
        send(res, 400, "Invalid PostHog payload");
        return;
      }
      send(res, 200, "OK");
      runTriageAsync(payload);
      return;
    }

    if (url === "/webhook/stripe") {
      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        send(res, 400, "Invalid JSON");
        return;
      }
      const incident = normalizePayload(payload);
      if (!incident) {
        send(res, 400, "Invalid Stripe payload");
        return;
      }
      send(res, 200, "OK");
      runTriageAsync(payload);
      return;
    }

    if (url === "/webhook/github") {
      const event = req.headers["x-github-event"] as string | undefined;
      if (!event) {
        send(res, 400, "Missing X-GitHub-Event header");
        return;
      }
      const supported = ["deployment_status", "check_run", "workflow_run"];
      if (!supported.includes(event)) {
        send(res, 200, "Event ignored");
        return;
      }
      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        send(res, 400, "Invalid JSON");
        return;
      }
      const incident = normalizePayload(payload, { githubEvent: event });
      if (!incident) {
        send(res, 200, "No trigger (e.g. not failure)");
        return;
      }
      send(res, 200, "OK");
      runTriageAsync(payload, event);
      return;
    }

    send(res, 404, "Not Found");
  });

  server.listen(port, () => {
    console.log(`Webhook server listening on http://localhost:${port}`);
    console.log("  POST /webhook/prometheus");
    console.log("  POST /webhook/deploy");
    console.log("  POST /webhook/posthog");
    console.log("  POST /webhook/stripe");
    console.log("  POST /webhook/github (X-GitHub-Event: deployment_status | check_run | workflow_run)");
  });
}
