import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}) => (
  <div
    className={`flex flex-col items-center justify-center text-center ${
      compact ? 'py-8 px-4' : 'py-14 px-6'
    }`}
  >
    <div className="w-11 h-11 rounded-xl bg-[#142035] border border-subtle flex items-center justify-center mb-3 shadow-inner">
      <Icon className="w-5 h-5 text-slate-400" />
    </div>
    <h4 className="text-sm font-semibold text-slate-200 tracking-tight">{title}</h4>
    <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);
