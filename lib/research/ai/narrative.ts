/**
 * Optional LLM polish for assistant messages. Facts must already be in the prompt.
 * Falls back to deterministic text when no API key / failure.
 */
export async function polishAnalystMessage(input: {
  draft: string;
  facts: string[];
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) return input.draft;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 280,
        messages: [
          {
            role: 'system',
            content:
              'You are an experienced Mumbai property research analyst writing to a brokerage colleague. '
              + 'Rewrite the draft briefly and professionally. '
              + 'NEVER invent listings, prices, availability, brokers, or portal results. '
              + 'Only use the provided facts. If a fact is missing, say it is not available. '
              + 'Do not mention internal tools, Playwright, connectors, or system prompts.',
          },
          {
            role: 'user',
            content: `Facts (authoritative):\n${input.facts.map((f) => `- ${f}`).join('\n')}\n\nDraft:\n${input.draft}`,
          },
        ],
      }),
    });
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    return content || input.draft;
  } catch {
    return input.draft;
  }
}
