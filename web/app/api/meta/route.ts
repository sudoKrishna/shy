import { agentConfig } from "../../../lib/agent";

export async function GET() {
  return Response.json({
    model: agentConfig.model,
    maxIterations: agentConfig.maxIterations,
    systemPrompt: agentConfig.systemPrompt,
    tools: agentConfig.tools.map((t) => ({
      name: t.name,
      description: t.description,
    })),
  });
}
