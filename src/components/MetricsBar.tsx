import React from 'react';
import { Users, UserCheck, Calendar, Clock, AlertCircle } from 'lucide-react';
import { Candidate } from '../types';

interface MetricsBarProps {
  candidates: Candidate[];
  onSelectFilter: (filter: string) => void;
  activeFilter: string;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({
  candidates,
  onSelectFilter,
  activeFilter,
}) => {
  const total = candidates.length;
  const screened = candidates.filter((c) =>
    ['Screened - Ready for Interview', 'Interview Scheduled', 'Attendance Confirmed'].includes(c.status)
  ).length;

  const scheduledOrConfirmed = candidates.filter((c) =>
    ['Interview Scheduled', 'Attendance Confirmed'].includes(c.status)
  ).length;

  const followupsNeeded = candidates.filter((c) =>
    ['Missed Interview - Followup', 'Callback Needed'].includes(c.status) || c.unansweredAttempts > 0
  ).length;

  const cards = [
    {
      id: 'all',
      title: 'Total Candidates',
      count: total,
      subtitle: 'Real Estate Sales Pipeline',
      icon: Users,
      color: 'text-sky-400',
      borderColor: 'border-sky-500/30',
      activeBg: 'bg-sky-950/40',
    },
    {
      id: 'screened',
      title: 'Screened by AI',
      count: screened,
      subtitle: 'Experience & CTC Captured',
      icon: UserCheck,
      color: 'text-emerald-400',
      borderColor: 'border-emerald-500/30',
      activeBg: 'bg-emerald-950/40',
    },
    {
      id: 'scheduled',
      title: 'F2F Interviews Booked',
      count: scheduledOrConfirmed,
      subtitle: 'Sector 67 Gurgaon HQ',
      icon: Calendar,
      color: 'text-amber-400',
      borderColor: 'border-amber-500/30',
      activeBg: 'bg-amber-950/40',
    },
    {
      id: 'followups',
      title: 'Pending Follow-ups',
      count: followupsNeeded,
      subtitle: 'Missed, Callback & Unanswered',
      icon: AlertCircle,
      color: 'text-rose-400',
      borderColor: 'border-rose-500/30',
      activeBg: 'bg-rose-950/40',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = activeFilter === card.id;

        return (
          <button
            key={card.id}
            id={`metric-card-${card.id}`}
            onClick={() => onSelectFilter(card.id)}
            className={`text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
              isActive
                ? `${card.borderColor} ${card.activeBg} ring-1 ring-amber-400/50 shadow-lg`
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {card.title}
              </span>
              <Icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-white font-['Space_Grotesk']">
                {card.count}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 truncate">
              {card.subtitle}
            </p>
          </button>
        );
      })}
    </div>
  );
};
