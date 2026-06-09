'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { EstimateModuleId, ModulePricingConfig } from '@/lib/estimate/types';

const MODULES: EstimateModuleId[] = [
  'home-interior',
  'rental-furnishing',
  'modular-kitchen',
  'wardrobe',
  'office-interior',
  'commercial-interior',
];

export default function QuotationPricingPanel() {
  const [moduleId, setModuleId] = useState<EstimateModuleId>('home-interior');
  const [config, setConfig] = useState<ModulePricingConfig | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch(`/api/admin/quotation/pricing?moduleId=${moduleId}`, { credentials: 'include' });
    const data = await res.json();
    if (res.ok) setConfig(data.config);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  async function save() {
    if (!config) return;
    setLoading(true);
    setMessage('');
    const res = await fetch('/api/admin/quotation/pricing', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId, config }),
    });
    const data = await res.json();
    setMessage(res.ok ? 'Pricing saved.' : data.error || 'Save failed');
    setLoading(false);
  }

  if (!config) return <p className="text-slate-500">Loading pricing...</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {MODULES.map((m) => (
          <Button key={m} variant={moduleId === m ? 'default' : 'outline'} onClick={() => setModuleId(m)} className={moduleId === m ? 'bg-orange-600 text-white' : ''}>
            {m}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Min / Max Project Cost</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <Input type="number" value={config.minProjectCost} onChange={(e) => setConfig({ ...config, minProjectCost: Number(e.target.value) })} />
            <Input type="number" value={config.maxProjectCost} onChange={(e) => setConfig({ ...config, maxProjectCost: Number(e.target.value) })} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Service Base Rate</CardTitle></CardHeader>
          <CardContent>
            <Input
              type="number"
              value={config.services[0]?.baseRate || 0}
              onChange={(e) =>
                setConfig({
                  ...config,
                  services: config.services.map((s, i) => (i === 0 ? { ...s, baseRate: Number(e.target.value) } : s)),
                })
              }
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Packages</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {config.packages.map((pkg, index) => (
            <div key={pkg.id} className="grid gap-2 rounded-xl border border-slate-100 p-3 md:grid-cols-3">
              <Input value={pkg.name} onChange={(e) => {
                const packages = [...config.packages];
                packages[index] = { ...pkg, name: e.target.value };
                setConfig({ ...config, packages });
              }} />
              <Input type="number" step="0.01" value={pkg.baseMultiplier} onChange={(e) => {
                const packages = [...config.packages];
                packages[index] = { ...pkg, baseMultiplier: Number(e.target.value) };
                setConfig({ ...config, packages });
              }} />
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={pkg.enabled} onChange={(e) => {
                  const packages = [...config.packages];
                  packages[index] = { ...pkg, enabled: e.target.checked };
                  setConfig({ ...config, packages });
                }} />
                Enabled
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>City Multipliers</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {config.cities.map((city, index) => (
            <div key={city.id} className="grid gap-2 rounded-xl border border-slate-100 p-3 md:grid-cols-3">
              <span className="font-bold">{city.name}</span>
              <Input type="number" step="0.01" value={city.multiplier} onChange={(e) => {
                const cities = [...config.cities];
                cities[index] = { ...city, multiplier: Number(e.target.value) };
                setConfig({ ...config, cities });
              }} />
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={city.enabled} onChange={(e) => {
                  const cities = [...config.cities];
                  cities[index] = { ...city, enabled: e.target.checked };
                  setConfig({ ...config, cities });
                }} />
                Enabled
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Materials</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {config.materials.map((material, index) => (
            <div key={material.id} className="rounded-xl border border-slate-100 p-3 text-sm">
              <p className="font-bold">{material.name}</p>
              <Input type="number" step="0.01" className="mt-2" value={material.multiplier} onChange={(e) => {
                const materials = [...config.materials];
                materials[index] = { ...material, multiplier: Number(e.target.value) };
                setConfig({ ...config, materials });
              }} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Add-ons</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {config.addons.map((addon, index) => (
            <div key={addon.id} className="grid gap-2 rounded-xl border border-slate-100 p-3 md:grid-cols-4">
              <span className="font-bold">{addon.name}</span>
              <Input type="number" value={addon.fixedPrice} onChange={(e) => {
                const addons = [...config.addons];
                addons[index] = { ...addon, fixedPrice: Number(e.target.value) };
                setConfig({ ...config, addons });
              }} />
              <Input type="number" value={addon.perSqftPrice} onChange={(e) => {
                const addons = [...config.addons];
                addons[index] = { ...addon, perSqftPrice: Number(e.target.value) };
                setConfig({ ...config, addons });
              }} />
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={addon.enabled} onChange={(e) => {
                  const addons = [...config.addons];
                  addons[index] = { ...addon, enabled: e.target.checked };
                  setConfig({ ...config, addons });
                }} />
                Enabled
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button disabled={loading} onClick={save} className="bg-orange-600 font-black text-white hover:bg-orange-700">
        {loading ? 'Saving...' : 'Save Pricing'}
      </Button>
      {message && <p className="text-sm font-semibold text-orange-600">{message}</p>}
    </div>
  );
}
