'use client';

import type { ReactNode } from 'react';

/**
 * Lightweight markdown renderer for assistant replies (no new dependencies).
 * Supports paragraphs, bold, italic, inline code, fenced code, lists, headings.
 */
export default function ResearchMarkdown({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  const blocks = splitBlocks(text);

  return (
    <div
      className={`space-y-3 text-[15px] leading-relaxed text-slate-800 dark:text-slate-100 ${className}`}
    >
      {blocks.map((block, i) => {
        if (block.type === 'code') {
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-950 px-3 py-2.5 text-[12px] leading-relaxed text-slate-100 dark:border-slate-700"
            >
              <code>{block.content}</code>
            </pre>
          );
        }
        if (block.type === 'heading') {
          const Tag = block.level === 1 ? 'h3' : block.level === 2 ? 'h4' : 'h5';
          return (
            <Tag
              key={i}
              className="font-semibold tracking-tight text-slate-900 dark:text-slate-50"
            >
              {renderInline(block.content)}
            </Tag>
          );
        }
        if (block.type === 'list') {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-200">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {renderInline(block.content)}
          </p>
        );
      })}
    </div>
  );
}

type Block =
  | { type: 'paragraph'; content: string }
  | { type: 'heading'; level: 1 | 2 | 3; content: string }
  | { type: 'code'; content: string }
  | { type: 'list'; items: string[] };

function splitBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ type: 'code', content: code.join('\n') });
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: Math.min(3, heading[1].length) as 1 | 2 | 3,
        content: heading[2],
      });
      i += 1;
      continue;
    }
    if (/^[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*•]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'list', items });
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const para: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('```') &&
      !/^#{1,3}\s+/.test(lines[i]) &&
      !/^[-*•]\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: 'paragraph', content: para.join('\n') });
  }
  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={key++} className="font-semibold text-slate-900 dark:text-slate-50">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('*')) {
      nodes.push(
        <em key={key++} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    } else {
      nodes.push(
        <code
          key={key++}
          className="rounded-md bg-slate-100 px-1 py-0.5 font-mono text-[12px] text-slate-800 dark:bg-slate-800 dark:text-slate-100"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
