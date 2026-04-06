import React, { useState, useMemo } from 'react';
import { Search, Filter, Briefcase, GraduationCap, ChevronDown, ChevronUp } from 'lucide-react';

const formatLpa = (value) => Number(value || 0).toFixed(2);

const getInitials = (bName) => {
  if (!bName) return '??';
  const parts = bName.replace(/[^A-Za-z0-9 ]/g, ' ').split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

const PlacementTypeIcon = ({ type }) => {
  if (type === 'PPO') return <span className="flex items-center gap-1 text-purple-400"><div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgb(168,85,247)]" /> PPO</span>;
  if (type === 'Off-campus') return <span className="flex items-center gap-1 text-blue-400"><div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgb(59,130,246)]" /> Off-campus</span>;
  return <span className="flex items-center gap-1 text-emerald-400"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgb(16,185,129)]" /> On-campus</span>;
};

const PackageBadge = ({ val }) => {
  const num = Number(val || 0);
  if (num >= 20) return <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold tracking-wide">{num.toFixed(2)} LPA</span>;
  if (num >= 10) return <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold tracking-wide">{num.toFixed(2)} LPA</span>;
  return <span className="px-2.5 py-1 rounded-md bg-slate-500/10 text-slate-300 border border-slate-500/20 font-bold">{num.toFixed(2)} LPA</span>;
};

export default function PlacementTable({ placements, loading, filters, setFilter, YEARS, localFilter, setLocalFilter, uniqueDepartments }) {
  const [sortConfig, setSortConfig] = useState({ key: 'package', direction: 'desc' });

  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const sortedAndFiltered = useMemo(() => {
    let result = [...placements];

    // Sort
    result.sort((a, b) => {
      if (sortConfig.key === 'package') {
        const pkgA = a.package || 0;
        const pkgB = b.package || 0;
        return sortConfig.direction === 'asc' ? pkgA - pkgB : pkgB - pkgA;
      }
      if (sortConfig.key === 'company') {
        const cA = a.company || '';
        const cB = b.company || '';
        return sortConfig.direction === 'asc' ? cA.localeCompare(cB) : cB.localeCompare(cA);
      }
      return 0;
    });

    return result;
  }, [placements, sortConfig]);

  return (
    <div className="rounded-2xl border border-white/5 bg-[#0f172a]/80 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col h-full overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-tr from-slate-900/50 via-transparent to-indigo-900/10 pointer-events-none" />
      
      <div className="p-6 border-b border-white/5 relative z-10 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h3 className="text-lg font-display font-semibold text-white flex items-center gap-2">
            <Briefcase className="text-indigo-400" size={20} />
            Placement Records
          </h3>
          <p className="text-sm text-slate-400 mt-1">Search, sort, and filter recent hires</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* API Driven Search */}
          <div className="relative group">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
            <input
              type="text"
              placeholder="Search company..."
              value={filters.company}
              onChange={(e) => setFilter('company', e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 w-full sm:w-48 transition-all"
            />
          </div>

          {/* API Driven Year */}
          <select
            value={filters.academicYear}
            onChange={(e) => setFilter('academicYear', e.target.value)}
            className="px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer hover:bg-slate-800 transition-colors"
          >
            <option value="">All Years</option>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Local Filter: Scope */}
          <select
            value={localFilter.type}
            onChange={(e) => setLocalFilter(prev => ({ ...prev, type: e.target.value }))}
            className="px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer hover:bg-slate-800 transition-colors"
          >
            <option value="">All Types</option>
            <option value="On-campus">On-campus</option>
            <option value="Off-campus">Off-campus</option>
            <option value="PPO">PPO</option>
          </select>

          {/* Local Filter: Department */}
          <select
            value={localFilter.department}
            onChange={(e) => setLocalFilter(prev => ({ ...prev, department: e.target.value }))}
            className="px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer hover:bg-slate-800 transition-colors"
          >
            <option value="">All Departments</option>
            {uniqueDepartments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          {/* Local Filter: Package */}
          <select
            value={localFilter.range}
            onChange={(e) => setLocalFilter(prev => ({ ...prev, range: e.target.value }))}
            className="px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer hover:bg-slate-800 transition-colors"
          >
            <option value="">All Packages</option>
            <option value=">20">Elite (&gt;20 LPA)</option>
            <option value="10-20">Premium (10-20 LPA)</option>
            <option value="<10">Standard (&lt;10 LPA)</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto relative z-10">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02]">
              <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Student</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Dept</th>
              <th 
                className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors group"
                onClick={() => handleSort('company')}
              >
                <div className="flex items-center gap-1">
                  Company {sortConfig.key === 'company' && (sortConfig.direction === 'asc' ? <ChevronUp size={14} className="text-indigo-400" /> : <ChevronDown size={14} className="text-indigo-400" />)}
                </div>
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Role</th>
              <th 
                className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors group"
                onClick={() => handleSort('package')}
              >
                <div className="flex items-center gap-1 bg-white/[0.03] px-2 py-1 rounded-md backdrop-blur-sm border border-white/5 hover:bg-white/10">
                  <span className="text-white">Package</span>
                  {sortConfig.key === 'package' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} className="text-indigo-400" /> : <ChevronDown size={14} className="text-indigo-400" />) : <ChevronDown size={14} className="opacity-0 group-hover:opacity-100" />}
                </div>
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Year</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-6 py-4"><div className="h-4 bg-slate-800 rounded w-full"></div></td>
                  ))}
                </tr>
              ))
            ) : sortedAndFiltered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <Filter className="opacity-20" size={32} />
                    <p>No records found matching your filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedAndFiltered.map((p) => (
                <tr key={p._id} className="hover:bg-white/[0.03] transition-colors group cursor-default">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 border border-white/5 shadow-sm group-hover:border-indigo-500/30 transition-colors">
                        {getInitials(p.student?.name)}
                      </div>
                      <span className="font-medium text-slate-200">{p.student?.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2.5 py-1 text-[11px] font-bold tracking-wider rounded border bg-indigo-500/10 text-indigo-300 border-indigo-500/20 uppercase shadow-[inset_0_1px_4px_rgba(99,102,241,0.1)]">
                      {p.student?.department?.code || 'NA'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-300 group-hover:text-white transition-colors">{p.company}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{p.role}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <PackageBadge val={p.package} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <PlacementTypeIcon type={p.placementType} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-500 text-right">{p.academicYear}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
