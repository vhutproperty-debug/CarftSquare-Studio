import { redirect } from 'next/navigation';
import { bindBrokerCrmPageToSession } from '@/lib/ops/broker-crm/page-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function OpsProjectsPage() {
  bindBrokerCrmPageToSession();
  redirect('/ops/projects/developer');
}
