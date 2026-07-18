'use client';

import type { ReactNode } from 'react';
import ResearchEmptyState from '@/components/research/ResearchEmptyState';
import ResearchShell from '@/components/research/ResearchShell';

type Props = {
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyDescription: string;
  action?: ReactNode;
  userLabel?: string;
};

export default function ResearchPageFrame({
  title,
  subtitle,
  emptyTitle,
  emptyDescription,
  action,
  userLabel,
}: Props) {
  return (
    <ResearchShell title={title} subtitle={subtitle} userLabel={userLabel} actions={action}>
      <ResearchEmptyState title={emptyTitle} description={emptyDescription} action={action} />
    </ResearchShell>
  );
}
