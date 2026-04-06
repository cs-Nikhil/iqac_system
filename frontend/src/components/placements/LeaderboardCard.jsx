import React, { useMemo } from 'react';
import { Trophy, TrendingUp, Building2, Medal } from 'lucide-react';

const formatLpa = (value) => `${Number(value || 0).toFixed(2)} LPA`;

const getInitials = (bName) => {
  if (!bName) return 'CO';
  const parts = bName.replace(/[^A-Za-z0-9 ]/g, ' ').split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

export default function LeaderboardCard({ placements = [] }) {
  const { topPackages, summary } = useMemo(() => {
    if (!placements.length) return { topPackages: [], summary: { highest: 0, avgTop10: 0, topCompany: 'N/A' } };
    
    // 1. Calculate top 10 packages
    const sortedPackages = [...placements].sort((a, b) => (b.package || 0) - (a.package || 0));
    const topPackagesArray = sortedPackages.slice(0, 10);

    // 2. Compute highest
    const highest = topPackagesArray[0]?.package || 0;

    // 3. Compute top 10 Average
    const sum = topPackagesArray.reduce((acc, p) => acc + (p.package || 0), 0);
    const avgTop10 = sum / topPackagesArray.length;

    // 4. Compute top hiring company from entire dataset
    const companyCounts = {};
    let topCompany = 'N/A';
    let maxCount = 0;
    placements.forEach(p => {
      const company = p.company || 'Unknown';
      if (!companyCounts[company]) companyCounts[company] = 0;
      companyCounts[company]++;
      if (companyCounts[company] > maxCount) {
        maxCount = companyCounts[company];
        topCompany = company;
      }
    });

    return {
      topPackages: topPackagesArray,
      summary: { highest, avgTop10, topCompany }
    };
  }, [placements]);

  return (
    <div className="rounded-2xl border border-white/5 bg-[#0f172a]/80 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col h-full overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-blue-500/5 pointer-events-none" />
      
      <div className="p-6 border-b border-white/5 relative z-10">
        <h3 className="text-lg font-display font-semibold text-white flex items-center gap-2">
          <Trophy className="text-amber-400" size={20} />
          Top Packages Leaderboard
        </h3>
        <p className="text-sm text-slate-400 mt-1">Hall of fame for highest compensation offers</p>
        
        {/* Summary Insights */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 text-center transition-all hover:bg-white/[0.06]">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Highest</p>
            <p className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500">
              {formatLpa(summary.highest)}
            </p>
          </div>
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 text-center transition-all hover:bg-white/[0.06]">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Top 10 Avg</p>
            <p className="text-lg font-bold text-emerald-400">
              {formatLpa(summary.avgTop10)}
            </p>
          </div>
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 text-center transition-all hover:bg-white/[0.06] overflow-hidden">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Top Hirer</p>
            <p className="text-[13px] font-bold text-blue-400 mt-1.5 truncate px-1">
              {summary.topCompany}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 relative z-10">
        <div className="space-y-2">
          {topPackages.map((placement, index) => {
            const isFirst = index === 0;
            const isSecond = index === 1;
            const isThird = index === 2;
            
            let rankBadge = <span className="text-slate-500 font-mono text-xs w-6 text-center">#{index + 1}</span>;
            if (isFirst) rankBadge = <span className="text-2xl" title="Rank 1">🥇</span>;
            else if (isSecond) rankBadge = <span className="text-2xl" title="Rank 2">🥈</span>;
            else if (isThird) rankBadge = <span className="text-2xl" title="Rank 3">🥉</span>;

            return (
              <div 
                key={placement._id + index}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 hover:scale-[1.02] cursor-default
                  ${isFirst ? 'bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 shadow-[inset_0_0_20px_rgba(245,158,11,0.05)]' : 'bg-white/[0.02] hover:bg-white/[0.06] border border-transparent'}
                `}
              >
                <div className="flex items-center justify-center w-8 shrink-0">
                  {rankBadge}
                </div>
                
                {/* Company Logo Fake */}
                <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xs font-bold text-white border border-white/10 shadow-inner">
                  {getInitials(placement.company)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200 truncate">{placement.student?.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                    <span className="truncate">{placement.company}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                    <span className="px-1.5 py-[1px] rounded bg-white/5 border border-white/5 text-[10px]">{placement.student?.department?.code || 'N/A'}</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className={`font-display font-bold text-[15px] ${isFirst ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'text-emerald-400'}`}>
                    {formatLpa(placement.package)}
                  </p>
                </div>
              </div>
            );
          })}
          
          {topPackages.length === 0 && (
            <div className="text-center py-10 text-slate-500 text-sm">No leaderboard data available</div>
          )}
        </div>
      </div>
    </div>
  );
}
