'use client';

import { useState } from 'react';
import { Copy, Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { BrokerShareCard } from '@/lib/ops/market/share-card';

type BrokerShareActionsProps = {
  card: BrokerShareCard;
  compact?: boolean;
};

function paintShareCard(card: BrokerShareCard): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(40, 40, 820, 560);

  const sizes = [54, 32, 32, 30, 28, 28];
  let y = 150;
  card.lines.forEach((line, index) => {
    const color = index === card.lines.length - 1 ? '#047857' : '#0f172a';
    let fontSize = sizes[index] || 28;
    const weight = index === 0 ? 700 : 600;
    ctx.font = `${weight} ${fontSize}px sans-serif`;
    while (ctx.measureText(line).width > 740 && fontSize > 18) {
      fontSize -= 2;
      ctx.font = `${weight} ${fontSize}px sans-serif`;
    }
    ctx.fillStyle = color;
    ctx.fillText(line, 80, y);
    y += index === 0 ? 78 : 62;
  });

  return canvas;
}

export default function BrokerShareActions({ card, compact = false }: BrokerShareActionsProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');

  async function copyText() {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(card.whatsAppText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError('Clipboard was blocked. Select the text below and copy it.');
    }
  }

  function downloadImage() {
    const canvas = paintShareCard(card);
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'share-card.png';
    link.click();
  }

  return (
    <>
      <Button type="button" size={compact ? 'sm' : 'default'} variant="outline" onClick={() => setOpen(true)}>
        <Share2 className="h-4 w-4" />
        Share card
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle>Broker share card</DialogTitle>
            <DialogDescription>
              Safe to forward. Rent, price, exact floor, unit number, owner name, owner phone, and brokerage terms stay off this card.
            </DialogDescription>
          </DialogHeader>
          <pre className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-950 px-4 py-4 text-sm leading-6 text-white">
            {card.whatsAppText}
          </pre>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={copyText}>
              <Copy className="h-4 w-4" />
              {copied ? 'Copied' : 'Copy WhatsApp text'}
            </Button>
            <Button type="button" variant="outline" onClick={downloadImage}>
              <Download className="h-4 w-4" />
              Download image
            </Button>
          </div>
          {copyError ? <p className="text-sm text-rose-700">{copyError}</p> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
