export type InboundMessageContent = {
  type: string;
  text: string | null;
  payload: string | null;
};

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Text stored for an inbound Cloud API message.
 * Template quick replies arrive as type "button" ({ text, payload }).
 * Interactive replies arrive as button_reply or list_reply titles.
 */
export function extractInboundMessageContent(
  message: Record<string, unknown>,
): InboundMessageContent {
  const type = String(message.type || 'text');

  if (type === 'text') {
    const body = clean((message.text as { body?: string } | undefined)?.body);
    return { type, text: body, payload: null };
  }

  if (type === 'button') {
    const button = message.button as { text?: string; payload?: string } | undefined;
    const text = clean(button?.text) || clean(button?.payload);
    return { type, text, payload: clean(button?.payload) };
  }

  if (type === 'interactive') {
    const interactive = message.interactive as {
      type?: string;
      button_reply?: { id?: string; title?: string };
      list_reply?: { id?: string; title?: string; description?: string };
    } | undefined;
    const buttonReply = interactive?.button_reply;
    const listReply = interactive?.list_reply;
    const text = clean(buttonReply?.title)
      || clean(listReply?.title)
      || clean(listReply?.description)
      || clean(buttonReply?.id)
      || clean(listReply?.id);
    return {
      type,
      text,
      payload: clean(buttonReply?.id) || clean(listReply?.id),
    };
  }

  const media = message[type] as { caption?: string } | undefined;
  return { type, text: clean(media?.caption), payload: null };
}
