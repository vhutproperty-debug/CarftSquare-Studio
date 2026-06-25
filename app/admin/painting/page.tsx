'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, Image, MessageSquare, Paintbrush, Users } from 'lucide-react';
import { canAccess } from '@/lib/auth/rbac/client';
import PaintingGalleryPanel from '@/components/admin/painting/PaintingGalleryPanel';
import PaintingLeadsPanel from '@/components/admin/painting/PaintingLeadsPanel';
import PaintingTestimonialsPanel from '@/components/admin/painting/PaintingTestimonialsPanel';

const TABS = [
  { id: 'leads', label: 'Painting Leads', icon: Users },
  { id: 'gallery', label: 'Gallery', icon: Image },
  { id: 'testimonials', label: 'Testimonials', icon: MessageSquare },
];

export default function PaintingAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('leads');

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/status', { credentials: 'include' });
        const data = await res.json();
        if (!data.authenticated) {
          router.replace('/admin');
          return;
        }
        const canViewPainting =
          canAccess(data.user, 'painting', 'view') || canAccess(data.user, 'leads', 'view');
        if (!canViewPainting) {
          router.replace('/admin?denied=painting');
          return;
        }
        setUser(data.user);
      } catch {
        router.replace('/admin');
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">Loading Painting admin…</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="container flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Link href="/admin" className="hover:text-orange-600">Admin</Link>
              <span>/</span>
              <span className="text-slate-900">Painting Services</span>
            </div>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-900">
              <Paintbrush className="h-6 w-6 text-orange-600" aria-hidden="true" />
              Painting Module
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage painting leads, gallery, and testimonials for{' '}
              <a href="/painting" target="_blank" rel="noopener noreferrer" className="font-semibold text-orange-600 hover:underline">
                /painting
              </a>
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50"
            >
              <Home className="mr-2 h-4 w-4" aria-hidden="true" />
              Admin Home
            </Link>
            <a
              href="/painting"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50"
            >
              View Landing Page
            </a>
          </div>
        </div>
      </header>

      <div className="container py-8">
        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((item) => {
            const Icon = item.icon;
            const isActive = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium transition ${
                  isActive
                    ? 'bg-orange-600 text-white hover:bg-orange-700'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === 'leads' && <PaintingLeadsPanel />}
        {tab === 'gallery' && <PaintingGalleryPanel />}
        {tab === 'testimonials' && <PaintingTestimonialsPanel />}
      </div>
    </div>
  );
}
