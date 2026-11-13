import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const SkeletonLine: React.FC<SkeletonProps> = ({ className = 'h-4 w-full' }) => (
  <div className={`rounded-md shimmer-bg ${className}`} />
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`workstation-panel rounded-xl p-4 space-y-3 ${className}`}>
    <div className="flex items-center justify-between">
      <SkeletonLine className="h-3 w-24" />
      <SkeletonLine className="h-6 w-6 rounded-lg" />
    </div>
    <SkeletonLine className="h-6 w-32" />
    <SkeletonLine className="h-2.5 w-24" />
  </div>
);

export const MetricCardSkeleton = SkeletonCard;

export const ChartSkeleton: React.FC<{ height?: number }> = ({ height = 340 }) => (
  <div
    className="workstation-panel rounded-xl p-5 flex flex-col justify-between"
    style={{ height }}
  >
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <SkeletonLine className="h-6 w-28 rounded-lg" />
        <SkeletonLine className="h-5 w-24" />
      </div>
      <div className="flex items-center gap-1.5">
        <SkeletonLine className="h-7 w-10 rounded-lg" />
        <SkeletonLine className="h-7 w-10 rounded-lg" />
        <SkeletonLine className="h-7 w-10 rounded-lg" />
        <SkeletonLine className="h-7 w-14 rounded-lg" />
      </div>
    </div>

    {/* Simulated candlesticks + volume silhouette */}
    <div className="flex-1 flex items-end gap-2 pt-8 pb-3">
      {Array.from({ length: 28 }).map((_, i) => {
        const h = 24 + ((i * 41 + 13) % 62);
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
            <div
              className="w-full max-w-[12px] rounded shimmer-bg opacity-65"
              style={{ height: `${h}%` }}
            />
          </div>
        );
      })}
    </div>

    <div className="flex justify-between pt-2.5 border-t border-subtle">
      <SkeletonLine className="h-2.5 w-16" />
      <SkeletonLine className="h-2.5 w-16" />
      <SkeletonLine className="h-2.5 w-16" />
      <SkeletonLine className="h-2.5 w-16" />
    </div>
  </div>
);

export const SkeletonChart = ChartSkeleton;

export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 5 }) => (
  <div className="workstation-panel rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b border-subtle flex gap-4 bg-[#0B1220]/70">
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonLine key={i} className="h-3 flex-1" />
      ))}
    </div>
    <div className="divide-y divide-slate-800/40">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-4 py-3.5 flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonLine key={c} className={`h-3.5 flex-1 ${c === 0 ? 'max-w-[120px]' : ''}`} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const PortfolioSkeleton: React.FC = () => (
  <div className="workstation-panel rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
      <SkeletonLine className="h-4 w-44" />
      <SkeletonLine className="h-4 w-4 rounded" />
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-subtle bg-[#070B14]/40">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
    <SkeletonTable rows={4} cols={6} />
  </div>
);

export const NewsSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="workstation-panel rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SkeletonLine className="h-5 w-14 rounded-md" />
            <SkeletonLine className="h-4 w-24" />
          </div>
          <SkeletonLine className="h-5 w-20 rounded-full" />
        </div>
        <SkeletonLine className="h-4 w-full" />
        <SkeletonLine className="h-4 w-4/5" />
        <div className="flex justify-between pt-2 border-t border-subtle">
          <SkeletonLine className="h-3 w-20" />
          <SkeletonLine className="h-3 w-24" />
        </div>
      </div>
    ))}
  </div>
);

export const StrategySkeleton: React.FC = () => (
  <div className="space-y-3">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="p-3.5 rounded-xl bg-[#0B1220] border border-subtle space-y-2.5">
        <div className="flex items-center justify-between">
          <SkeletonLine className="h-4 w-36" />
          <SkeletonLine className="h-5 w-16 rounded-md" />
        </div>
        <div className="flex gap-1.5">
          <SkeletonLine className="h-4 w-20 rounded" />
          <SkeletonLine className="h-4 w-12 rounded" />
        </div>
        <div className="flex justify-between pt-2 border-t border-subtle">
          <SkeletonLine className="h-4 w-24" />
          <SkeletonLine className="h-6 w-14 rounded" />
        </div>
      </div>
    ))}
  </div>
);

export const StressTestSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCardSkeleton />
      <MetricCardSkeleton />
      <MetricCardSkeleton />
      <MetricCardSkeleton />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="workstation-panel rounded-2xl p-6 space-y-4">
        <SkeletonLine className="h-4 w-56" />
        <div className="grid grid-cols-2 gap-3.5">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonLine className="h-12 w-full rounded-xl" />
      </div>
      <div className="workstation-panel rounded-2xl p-6 space-y-3">
        <SkeletonLine className="h-4 w-48" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <SkeletonLine className="h-3 w-28" />
              <SkeletonLine className="h-3 w-16" />
            </div>
            <SkeletonLine className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
    <SkeletonTable rows={5} cols={6} />
  </div>
);

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-5">
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <MetricCardSkeleton />
      <MetricCardSkeleton />
      <MetricCardSkeleton />
      <MetricCardSkeleton />
    </div>
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} className="w-48 shrink-0 h-[132px]" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div className="lg:col-span-8 space-y-5">
        <ChartSkeleton height={420} />
        <PortfolioSkeleton />
      </div>
      <div className="lg:col-span-4 space-y-5">
        <SkeletonCard className="h-56" />
        <SkeletonCard className="h-52" />
      </div>
    </div>
  </div>
);
