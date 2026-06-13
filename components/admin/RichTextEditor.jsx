'use client';

import { useEffect, useRef } from 'react';
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Pilcrow } from 'lucide-react';
import { Button } from '@/components/ui/button';

function exec(command, value = null) {
  if (typeof document === 'undefined') return;
  document.execCommand(command, false, value);
}

function ToolbarButton({ onClick, children, title }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      title={title}
      onClick={onClick}
      className="h-8 border-slate-200 px-2 text-slate-700"
    >
      {children}
    </Button>
  );
}

export default function RichTextEditor({ value = '', onChange, placeholder = 'Write blog content…' }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  function syncHtml() {
    onChange?.(editorRef.current?.innerHTML || '');
  }

  function addLink() {
    const url = window.prompt('Enter link URL');
    if (!url) return;
    exec('createLink', url);
    syncHtml();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
        <ToolbarButton title="Bold" onClick={() => { exec('bold'); syncHtml(); }}><Bold className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton title="Italic" onClick={() => { exec('italic'); syncHtml(); }}><Italic className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton title="Heading 2" onClick={() => { exec('formatBlock', 'h2'); syncHtml(); }}><Heading2 className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton title="Heading 3" onClick={() => { exec('formatBlock', 'h3'); syncHtml(); }}><Heading3 className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton title="Paragraph" onClick={() => { exec('formatBlock', 'p'); syncHtml(); }}><Pilcrow className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton title="Bullet list" onClick={() => { exec('insertUnorderedList'); syncHtml(); }}><List className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton title="Numbered list" onClick={() => { exec('insertOrderedList'); syncHtml(); }}><ListOrdered className="h-4 w-4" /></ToolbarButton>
        <ToolbarButton title="Insert link" onClick={addLink}><Link2 className="h-4 w-4" /></ToolbarButton>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={syncHtml}
        onBlur={syncHtml}
        data-placeholder={placeholder}
        className="min-h-[280px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 outline-none focus:ring-2 focus:ring-orange-200 [&:empty]:before:text-slate-400 [&:empty]:before:content-[attr(data-placeholder)] [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-black [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-bold [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6"
      />
    </div>
  );
}
