'use client';

import { useEffect, useState } from 'react';
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

type AddProspectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export default function AddProspectDialog({ open, onOpenChange, onCreated }: AddProspectDialogProps) {
  const [team, setTeam] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    prospectType: 'unknown',
    projectName: '',
    building: '',
    location: '',
    requirement: '',
    notes: '',
    assignedTo: '',
  });

  useEffect(() => {
    if (!open) return;
    fetch('/api/ops/team', { credentials: 'include' })
      .then((response) => response.json())
      .then((data) => setTeam(data.members || []))
      .catch(() => setTeam([]));
  }, [open]);

  function resetForm() {
    setForm({
      name: '',
      phone: '',
      prospectType: 'unknown',
      projectName: '',
      building: '',
      location: '',
      requirement: '',
      notes: '',
      assignedTo: '',
    });
    setError('');
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/ops/prospects', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Unable to create prospect.');
        return;
      }
      resetForm();
      onOpenChange(false);
      onCreated();
    } catch {
      setError('Unable to create prospect.');
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
          <DialogTitle>Add Cold-Call Prospect</DialogTitle>
          <DialogDescription>
            Create an ops-owned prospect for cold calling. This does not modify public lead collections.
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
          <select
            className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
            value={form.prospectType}
            onChange={(event) => setForm((current) => ({ ...current, prospectType: event.target.value }))}
          >
            <option value="homeowner">Homeowner</option>
            <option value="rental_owner">Rental Owner</option>
            <option value="buyer">Buyer</option>
            <option value="tenant">Tenant</option>
            <option value="interior_prospect">Interior Prospect</option>
            <option value="broker">Broker</option>
            <option value="unknown">Unknown</option>
          </select>
          <Input
            placeholder="Project name"
            value={form.projectName}
            onChange={(event) => setForm((current) => ({ ...current, projectName: event.target.value }))}
          />
          <Input
            placeholder="Building"
            value={form.building}
            onChange={(event) => setForm((current) => ({ ...current, building: event.target.value }))}
          />
          <Input
            placeholder="Location"
            value={form.location}
            onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
          />
          <Textarea
            placeholder="Requirement"
            value={form.requirement}
            onChange={(event) => setForm((current) => ({ ...current, requirement: event.target.value }))}
          />
          <Textarea
            placeholder="Notes"
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          />
          <select
            className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
            value={form.assignedTo}
            onChange={(event) => setForm((current) => ({ ...current, assignedTo: event.target.value }))}
          >
            <option value="">Assign to me (default)</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name || member.email}
              </option>
            ))}
          </select>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Saving…' : 'Create Prospect'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
