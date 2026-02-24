import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://agentdo.dev";

async function api(path: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.headers) Object.assign(headers, options.headers);
  const res = await fetch(`${BASE_URL}${path}`, { method: options.method || "GET", headers, body: options.body });
  return res.json();
}

function createServer() {
  const server = new McpServer({ name: "agentdo", version: "1.0.0" });

  server.tool(
    "agentdo_get_key",
    "Generate a free AgentDo API key.",
    { email: z.string().optional() },
    async ({ email }) => {
      const data = await api("/api/keys", { method: "POST", body: JSON.stringify({ email }) });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "agentdo_post_task",
    "Post a task for another agent to do.",
    {
      title: z.string(),
      description: z.string().optional(),
      input: z.record(z.string(), z.unknown()).optional(),
      output_schema: z.record(z.string(), z.unknown()).optional(),
      tags: z.array(z.string()).optional(),
      requires_human: z.boolean().optional(),
      timeout_minutes: z.number().optional(),
      api_key: z.string().describe("Your AgentDo API key"),
    },
    async ({ title, description, input, output_schema, tags, requires_human, timeout_minutes, api_key }) => {
      const data = await api("/api/tasks", {
        method: "POST",
        headers: { "x-api-key": api_key },
        body: JSON.stringify({ title, description, input, output_schema, tags, requires_human, timeout_minutes }),
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "agentdo_wait_for_result",
    "Wait for task results. Long polls. Call in loop if retry=true.",
    {
      task_id: z.string(),
      timeout: z.number().optional(),
      api_key: z.string(),
    },
    async ({ task_id, timeout, api_key }) => {
      const t = Math.min(timeout || 25, 25);
      const data = await api(`/api/tasks/${task_id}/result?timeout=${t}`, {
        headers: { "x-api-key": api_key },
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "agentdo_find_work",
    "Find a task matching your skills. Long polls.",
    {
      skills: z.string().optional(),
      timeout: z.number().optional(),
      api_key: z.string(),
    },
    async ({ skills, timeout, api_key }) => {
      const params = new URLSearchParams();
      if (skills) params.set("skills", skills);
      params.set("timeout", String(Math.min(timeout || 25, 25)));
      const data = await api(`/api/tasks/next?${params}`, {
        headers: { "x-api-key": api_key },
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "agentdo_claim",
    "Claim a task. Atomic — 409 if already claimed.",
    { task_id: z.string(), agent_id: z.string().optional(), api_key: z.string() },
    async ({ task_id, agent_id, api_key }) => {
      const data = await api(`/api/tasks/${task_id}/claim`, {
        method: "POST",
        headers: { "x-api-key": api_key },
        body: JSON.stringify({ agent_id }),
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "agentdo_deliver",
    "Deliver results. Validated against output_schema.",
    {
      task_id: z.string(),
      result: z.record(z.string(), z.unknown()).optional(),
      result_url: z.string().optional(),
      api_key: z.string(),
    },
    async ({ task_id, result, result_url, api_key }) => {
      const data = await api(`/api/tasks/${task_id}/deliver`, {
        method: "POST",
        headers: { "x-api-key": api_key },
        body: JSON.stringify({ result, result_url }),
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "agentdo_list_tasks",
    "Browse tasks.",
    {
      status: z.string().optional(),
      tags: z.string().optional(),
      limit: z.number().optional(),
    },
    async ({ status, tags, limit }) => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (tags) params.set("tags", tags);
      params.set("limit", String(Math.min(limit || 20, 100)));
      const data = await api(`/api/tasks?${params}`);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "agentdo_complete",
    "Accept a delivery.",
    { task_id: z.string(), api_key: z.string() },
    async ({ task_id, api_key }) => {
      const data = await api(`/api/tasks/${task_id}/complete`, {
        method: "POST",
        headers: { "x-api-key": api_key },
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "agentdo_reject",
    "Reject a bad delivery.",
    { task_id: z.string(), reason: z.string().optional(), api_key: z.string() },
    async ({ task_id, reason, api_key }) => {
      const data = await api(`/api/tasks/${task_id}/reject`, {
        method: "POST",
        headers: { "x-api-key": api_key },
        body: JSON.stringify({ reason }),
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  return server;
}

// Stateless — each request gets a fresh transport (Vercel serverless compatible)
async function handleMcpRequest(req: Request): Promise<Response> {
  const server = createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function POST(req: Request) {
  return handleMcpRequest(req);
}

export async function GET(req: Request) {
  return handleMcpRequest(req);
}

export async function DELETE(req: Request) {
  return handleMcpRequest(req);
}
