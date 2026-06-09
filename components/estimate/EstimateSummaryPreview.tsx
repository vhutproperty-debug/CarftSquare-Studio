import { Card, CardContent } from '@/components/ui/card';
import type { ProjectSummary } from '@/lib/estimate/types';

function storageScore(priority: string) {
  if (/essential/i.test(priority)) return 95;
  if (/important/i.test(priority)) return 80;
  if (/moderate/i.test(priority)) return 65;
  return 40;
}

export default function EstimateSummaryPreview({
  summary,
  propertyPurpose,
}: {
  summary: ProjectSummary;
  propertyPurpose?: string | null;
}) {
  const score = storageScore(summary.priority);

  return (
    <div className="estimate-scale-in space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="estimate-glass-card border-0 shadow-none">
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Recommended Package</p>
            <p className="mt-2 text-lg font-black text-slate-950">{summary.packageRecommendation}</p>
          </CardContent>
        </Card>
        <Card className="estimate-glass-card border-0 shadow-none">
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Design Style</p>
            <p className="mt-2 text-lg font-black text-slate-950">{summary.styleRecommendation}</p>
          </CardContent>
        </Card>
        <Card className="estimate-glass-card border-0 shadow-none">
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Material Recommendation</p>
            <p className="mt-2 text-lg font-black text-slate-950">{summary.materialRecommendation}</p>
          </CardContent>
        </Card>
        <Card className="estimate-glass-card border-0 shadow-none">
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Timeline</p>
            <p className="mt-2 text-lg font-black text-slate-950">{summary.timeline}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="estimate-glass-card border-0 shadow-none">
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Storage Score</p>
              <p className="mt-1 text-sm text-slate-600">Based on your storage priorities</p>
            </div>
            <p className="text-3xl font-black text-orange-600">{score}%</p>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="estimate-progress-fill h-full rounded-full transition-all duration-1000"
              style={{ width: `${score}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="estimate-glass-card border-0 shadow-none">
        <CardContent className="space-y-2 p-6 text-sm text-slate-600">
          <p className="font-black text-slate-950">AI Insights</p>
          <p>
            {propertyPurpose || summary.propertyPurpose
              ? `Optimised for ${propertyPurpose || summary.propertyPurpose} with ${summary.lifestyle} lifestyle needs.`
              : `Tailored for ${summary.lifestyle} lifestyle with focus on ${summary.priority}.`}
          </p>
          <p className="text-slate-500">
            Budget alignment: {summary.budget} · Project: {summary.projectType} · Area: {summary.area}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
