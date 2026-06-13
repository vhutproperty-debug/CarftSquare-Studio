'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Home, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import BlogManagementPanel from '@/app/admin/BlogManagementPanel';
import { canAccess } from '@/lib/auth/rbac/client';

const SIDEBAR_ITEMS = [
  { id: 'list', label: 'All Posts', icon: FileText },
  { id: 'create', label: 'Add Blog', icon: Plus, action: 'create' },
];

export default function BlogAdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    fetch('/api/auth/status', { credentials: 'include', signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        setAuthed(Boolean(data.authenticated));
        setUser(data.user || null);
        setChecked(true);

        if (data.authenticated && !canAccess(data.user, 'blog', 'view')) {
          router.replace('/admin?denied=blog');
        }
      })
      .catch(() => {
        setChecked(true);
        setAuthed(false);
      })
      .finally(() => {
        clearTimeout(timer);
        setChecked(true);
      });
  }, [router]);

  if (!checked) {
    return <div className="min-h-screen grid place-items-center bg-slate-950 text-white">Checking admin session...</div>;
  }

  if (!authed) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 text-white">
        <Card className="max-w-md">
          <CardContent className="space-y-4 p-8 text-center text-slate-950">
            <p className="font-bold">Admin login required.</p>
            <Link href="/admin"><Button className="bg-orange-600 text-white">Go to Admin Login</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 py-10 text-white">
      <div className="container space-y-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <Badge className="mb-3 bg-orange-500 text-white hover:bg-orange-500">Content</Badge>
            <h1 className="text-3xl font-black md:text-5xl">Blog Management</h1>
            <p className="mt-2 text-slate-300">Manage blog posts, drafts, SEO and publishing.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin">
              <Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                <Home className="mr-2 h-4 w-4" /> Main Admin
              </Button>
            </Link>
            <Link href="/blog">
              <Button className="bg-orange-600 font-black text-white hover:bg-orange-700">View Public Blog</Button>
            </Link>
          </div>
        </div>

        {message && (
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm font-semibold text-orange-700">{message}</div>
        )}

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <aside className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400">Blogs</p>
            <nav className="space-y-2">
              {SIDEBAR_ITEMS.map((item) => {
                const Icon = item.icon;
                if (item.action === 'create' && !canAccess(user, 'blog', 'create')) return null;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-200"
                  >
                    <Icon className="h-4 w-4 text-orange-300" />
                    {item.label}
                  </div>
                );
              })}
            </nav>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              Access is controlled by Blog permissions in RBAC. Published posts appear on the public blog; drafts remain hidden.
            </p>
          </aside>

          <BlogManagementPanel user={user} onMessage={setMessage} />
        </div>
      </div>
    </main>
  );
}
