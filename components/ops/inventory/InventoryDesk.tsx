'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

type Developer = { id: string; name: string; locality: string; rera: string };
type Tower = { id: string; projectName: string; name: string; developerId: string };
type Apartment = { id: string; projectName: string; towerName: string; flat?: string; candidateUnitIds: string[] };
type Rental = { id: string; apartmentId: string; rent: string; deposit: string; status: string };

export default function InventoryDesk() {
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [error, setError] = useState('');
  const [developerName, setDeveloperName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [towerName, setTowerName] = useState('');
  const [flat, setFlat] = useState('');
  const [rent, setRent] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/ops/inventory', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Could not load inventory.');
      return;
    }
    setDevelopers(data.developers || []);
    setTowers(data.towers || []);
    setApartments(data.apartments || []);
    setRentals(data.rentals || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function post(body: Record<string, unknown>) {
    setError('');
    const response = await fetch('/api/ops/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Could not save.');
      return null;
    }
    await load();
    return data;
  }

  async function addDeveloper(event: FormEvent) {
    event.preventDefault();
    const data = await post({ kind: 'developer', name: developerName });
    if (data) setDeveloperName('');
  }

  async function addTower(event: FormEvent) {
    event.preventDefault();
    const developer = developers[0];
    if (!developer) {
      setError('Add a developer first.');
      return;
    }
    await post({ kind: 'tower', developerId: developer.id, projectName, name: towerName });
  }

  async function addApartment(event: FormEvent) {
    event.preventDefault();
    const tower = towers[0];
    if (!tower) {
      setError('Add a tower first.');
      return;
    }
    await post({
      kind: 'apartment',
      developerId: tower.developerId,
      towerId: tower.id,
      projectName: tower.projectName,
      towerName: tower.name,
      flat,
    });
  }

  async function addRental(event: FormEvent) {
    event.preventDefault();
    const apartment = apartments[0];
    if (!apartment) {
      setError('Add an apartment first.');
      return;
    }
    const data = await post({ kind: 'rental', apartmentId: apartment.id, rent, deposit: '' });
    if (data) setRent('');
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Registry beside the existing Projects screens. Matching flats share a canonical id and keep every candidate unit. Nothing is merged or deleted from resale inventory.
      </p>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold">Developers</h2>
        <form onSubmit={addDeveloper} className="mt-2 flex gap-2">
          <input aria-label="Developer name" value={developerName} onChange={(event) => setDeveloperName(event.target.value)} required className="h-10 flex-1 rounded-md border border-slate-200 px-3" />
          <button type="submit" className="rounded-md bg-orange-600 px-3 text-sm font-semibold text-white">Add</button>
        </form>
        <ul className="mt-2 text-sm">{developers.map((item) => <li key={item.id}>{item.name}{item.locality ? ` · ${item.locality}` : ''}</li>)}</ul>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold">Projects and towers</h2>
        <form onSubmit={addTower} className="mt-2 grid gap-2 md:grid-cols-3">
          <input aria-label="Project name" value={projectName} onChange={(event) => setProjectName(event.target.value)} required placeholder="Project" className="h-10 rounded-md border border-slate-200 px-3" />
          <input aria-label="Tower name" value={towerName} onChange={(event) => setTowerName(event.target.value)} required placeholder="Tower" className="h-10 rounded-md border border-slate-200 px-3" />
          <button type="submit" className="rounded-md bg-orange-600 px-3 text-sm font-semibold text-white">Add tower</button>
        </form>
        <ul className="mt-2 text-sm">{towers.map((item) => <li key={item.id}>{item.projectName} · Tower {item.name}</li>)}</ul>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold">Canonical apartments</h2>
        <form onSubmit={addApartment} className="mt-2 flex gap-2">
          <input aria-label="Flat number" value={flat} onChange={(event) => setFlat(event.target.value)} required placeholder="Flat" className="h-10 flex-1 rounded-md border border-slate-200 px-3" />
          <button type="submit" className="rounded-md bg-orange-600 px-3 text-sm font-semibold text-white">Add apartment</button>
        </form>
        <ul className="mt-2 text-sm">
          {apartments.map((item) => (
            <li key={item.id}>{item.projectName} · {item.towerName}{item.flat ? ` · ${item.flat}` : ''} · candidates {item.candidateUnitIds.length}</li>
          ))}
        </ul>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold">Rentals</h2>
        <form onSubmit={addRental} className="mt-2 flex gap-2">
          <input aria-label="Monthly rent" value={rent} onChange={(event) => setRent(event.target.value)} placeholder="Monthly rent" className="h-10 flex-1 rounded-md border border-slate-200 px-3" />
          <button type="submit" className="rounded-md bg-orange-600 px-3 text-sm font-semibold text-white">Add rental</button>
        </form>
        <ul className="mt-2 text-sm">{rentals.map((item) => <li key={item.id}>{item.status} · {item.rent || 'rent not set'}</li>)}</ul>
      </section>
    </div>
  );
}
