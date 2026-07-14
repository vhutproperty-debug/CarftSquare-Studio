'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type AddHousingComLeadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export default function AddHousingComLeadDialog({
  open,
  onOpenChange,
  onCreated,
}: AddHousingComLeadDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    location: '',
    requirement: '',
  });

  function resetForm() {
    setForm({
      name: '',
      phone: '',
      email: '',
      location: '',
      requirement: '',
    });
    setError('');
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/ops/leads/housing-com', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Unable to create Housing.com lead.');
        return;
      }
      resetForm();
      onOpenChange(false);
      onCreated();
    } catch {
      setError('Unable to create Housing.com lead.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Housing.com Lead</DialogTitle>
          <DialogDescription>
            Manually log a Housing.com enquiry into ops demand intake.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Input
            placeholder="Name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
          <Input
            placeholder="Phone *"
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            required
          />
          <Input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
          <Input
            placeholder="Location"
            value={form.location}
            onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
          />
          <Textarea
            placeholder="Requirement / notes"
            value={form.requirement}
            onChange={(event) => setForm((current) => ({ ...current, requirement: event.target.value }))}
          />
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Saving…' : 'Add Housing.com Lead'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
