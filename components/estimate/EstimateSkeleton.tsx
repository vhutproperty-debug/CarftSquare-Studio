import { Skeleton } from '@/components/ui/skeleton';

export default function EstimateSkeleton() {
  return (
    <div className="space-y-4 p-6" aria-busy="true" aria-label="Loading estimate">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
