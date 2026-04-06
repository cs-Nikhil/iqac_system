import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Download,
  FilePlus2,
  Filter,
  Loader2,
  Microscope,
  Sigma,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { researchAPI } from '../services/api';

const PUBLICATION_TYPES = ['Journal', 'Conference', 'Book Chapter', 'Patent'];
const INDEXING_OPTIONS = ['SCI', 'SCOPUS', 'UGC', 'WOS', 'Others'];
const BASE_YEARS = [2019, 2020, 2021, 2022, 2023, 2024];
const FEATURED_DEPARTMENTS = ['CSE', 'ECE', 'MECH', 'CIVIL'];
const CURRENT_YEAR = new Date().getFullYear();

const INDEXING_COLORS = {
  SCI: ['#7dd3fc', '#2563eb'],
  SCOPUS: ['#c084fc', '#7c3aed'],
  UGC: ['#fb7185', '#ec4899'],
  WOS: ['#6ee7b7', '#059669'],
  Others: ['#fbbf24', '#f97316'],
};

const initialForm = {
  title: '',
  journal: '',
  year: CURRENT_YEAR,
  citations: 0,
  publicationType: 'Journal',
  indexing: 'Others',
  doi: '',
  impactFactor: 0,
  coAuthors: '',
};

const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN');
const formatDecimal = (value, digits = 2) => Number(value || 0).toFixed(digits);
const formatCompactNumber = (value) => {
  const numericValue = Number(value || 0);

  if (numericValue >= 1000000) {
    return `${(numericValue / 1000000).toFixed(1)}M`;
  }

  if (numericValue >= 1000) {
    return `${(numericValue / 1000).toFixed(numericValue >= 10000 ? 0 : 1)}k`;
  }

  return String(numericValue);
};

const getDepartmentMeta = (paper) => {
  const department = paper.faculty?.department && typeof paper.faculty.department === 'object'
    ? paper.faculty.department
    : null;

  return {
    id: String(department?._id || paper.department || ''),
    name: department?.name || 'Department',
    code: department?.code || 'DEPT',
  };
};

const calculateHIndex = (papers = []) => {
  const citations = papers
    .map((paper) => Number(paper.citations || 0))
    .sort((left, right) => right - left);

  let hIndex = 0;

  for (let index = 0; index < citations.length; index += 1) {
    if (citations[index] >= index + 1) {
      hIndex = index + 1;
    }
  }

  return hIndex;
};

const buildTrendData = (papers, startYear, endYear) => {
  if (!papers.length || startYear > endYear) {
    return [];
  }

  const buckets = new Map();

  for (let year = startYear; year <= endYear; year += 1) {
    buckets.set(year, {
      year: String(year),
      papers: 0,
      citations: 0,
      isPeak: false,
    });
  }

  papers.forEach((paper) => {
    const year = Number(paper.year || 0);

    if (!buckets.has(year)) {
      return;
    }

    const bucket = buckets.get(year);
    bucket.papers += 1;
    bucket.citations += Number(paper.citations || 0);
  });

  const data = Array.from(buckets.values());
  const peak = data.reduce((best, current) => {
    if (current.citations > best.citations) {
      return current;
    }

    if (current.citations === best.citations && current.papers > best.papers) {
      return current;
    }

    return best;
  }, { citations: -1, papers: -1, year: null });

  return data.map((entry) => ({
    ...entry,
    isPeak: peak.year != null && entry.year === peak.year && peak.citations > 0,
  }));
};

const buildIndexingMix = (papers = []) => {
  const total = papers.length;
  const counts = papers.reduce((accumulator, paper) => {
    const key = paper.indexing || 'Others';
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  return INDEXING_OPTIONS.map((name) => ({
    name,
    value: counts[name] || 0,
    percentage: total ? ((counts[name] || 0) / total) * 100 : 0,
  })).filter((entry) => entry.value > 0);
};

const buildDepartmentOutput = (papers = []) => {
  const grouped = papers.reduce((accumulator, paper) => {
    const department = getDepartmentMeta(paper);
    const key = department.id || department.code || department.name;

    if (!accumulator[key]) {
      accumulator[key] = { ...department, papers: 0, citations: 0 };
    }

    accumulator[key].papers += 1;
    accumulator[key].citations += Number(paper.citations || 0);
    return accumulator;
  }, {});

  const rows = Object.values(grouped);
  const featured = FEATURED_DEPARTMENTS
    .map((code) => rows.find((row) => row.code === code))
    .filter(Boolean);
  const remaining = rows
    .filter((row) => !FEATURED_DEPARTMENTS.includes(row.code))
    .sort((left, right) => (right.papers - left.papers) || (right.citations - left.citations));

  return [...featured, ...remaining].slice(0, 4);
};

const downloadCsv = (papers, startYear, endYear) => {
  const rows = [
    ['Title', 'Faculty', 'Department', 'Year', 'Type', 'Indexing', 'Impact Factor', 'Citations', 'Journal', 'DOI'].join(','),
    ...papers.map((paper) =>
      [
        paper.title,
        paper.faculty?.name || '',
        getDepartmentMeta(paper).name,
        paper.year,
        paper.publicationType,
        paper.indexing,
        formatDecimal(paper.impactFactor || 0),
        paper.citations || 0,
        paper.journal,
        paper.doi || '',
      ]
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(',')
    ),
  ];

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `research-analytics-${startYear}-${endYear}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const getResearchTheme = (isLightTheme) => ({
  heroShell: isLightTheme
    ? 'border-line/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] shadow-[0_30px_90px_-48px_rgba(15,23,42,0.18)]'
    : 'border-white/10 bg-[linear-gradient(135deg,rgba(7,13,32,0.94),rgba(4,8,22,0.94))] shadow-[0_30px_110px_-56px_rgba(15,23,42,0.98)]',
  heroGlow: isLightTheme
    ? 'bg-[radial-gradient(circle_at_12%_18%,rgba(96,165,250,0.14),transparent_30%),radial-gradient(circle_at_78%_12%,rgba(52,211,153,0.1),transparent_26%),radial-gradient(circle_at_84%_78%,rgba(192,132,252,0.12),transparent_30%)]'
    : 'bg-[radial-gradient(circle_at_12%_18%,rgba(96,165,250,0.18),transparent_30%),radial-gradient(circle_at_78%_12%,rgba(52,211,153,0.16),transparent_26%),radial-gradient(circle_at_84%_78%,rgba(192,132,252,0.18),transparent_30%)]',
  heroEyebrow: isLightTheme
    ? 'border-line/70 bg-white/85 text-slate-700'
    : 'border-white/10 bg-white/[0.06] text-white/90',
  heroTitle: isLightTheme ? 'text-slate-900' : 'text-white',
  heroBody: isLightTheme ? 'text-slate-600' : 'text-slate-200',
  heroChipBlue: isLightTheme
    ? 'border-blue-200/80 bg-blue-50 text-blue-700'
    : 'border-blue-400/18 bg-blue-500/10 text-blue-100',
  heroChipGreen: isLightTheme
    ? 'border-emerald-200/80 bg-emerald-50 text-emerald-700'
    : 'border-emerald-400/18 bg-emerald-500/10 text-emerald-100',
  heroChipViolet: isLightTheme
    ? 'border-violet-200/80 bg-violet-50 text-violet-700'
    : 'border-violet-400/18 bg-violet-500/10 text-violet-100',
  filterShell: isLightTheme
    ? 'border-line/70 bg-slate-50/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]'
    : 'border-white/10 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
  statCard: isLightTheme
    ? 'border-line/70 bg-white/92 shadow-[0_18px_46px_-36px_rgba(15,23,42,0.18)] hover:border-line-strong/60'
    : 'border-white/10 bg-[rgba(5,10,24,0.82)] shadow-[0_26px_80px_-46px_rgba(15,23,42,0.95)] hover:border-white/16',
  statLabel: isLightTheme ? 'text-content-muted' : 'text-white/55',
  statValue: isLightTheme ? 'text-slate-900' : 'text-white',
  statNote: isLightTheme ? 'text-content-secondary' : 'text-slate-400',
  statIconShell: isLightTheme
    ? 'border-line/70 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.12)]'
    : 'border-white/10',
  statIconBackground: (accent) =>
    isLightTheme
      ? `linear-gradient(145deg, ${accent}18, rgba(255,255,255,0.96))`
      : `linear-gradient(145deg, ${accent}2a, rgba(15,23,42,0.86))`,
  panelShell: isLightTheme
    ? 'border-line/70 bg-white/92 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.18)]'
    : 'border-white/10 bg-[rgba(5,10,24,0.78)] shadow-[0_26px_90px_-50px_rgba(15,23,42,0.96)]',
  panelGlow: isLightTheme
    ? 'bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.08),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(52,211,153,0.06),transparent_28%)]'
    : 'bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.08),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(52,211,153,0.08),transparent_28%)]',
  panelBadge: isLightTheme
    ? 'border-line/70 bg-white text-content-secondary'
    : 'border-white/10 bg-white/[0.06] text-content-secondary',
  indexingCard: isLightTheme
    ? 'border-line/70 bg-white/85 hover:border-line-strong/70'
    : 'border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] hover:border-white/14',
  progressTrack: isLightTheme ? 'bg-slate-200/90' : 'bg-white/[0.06]',
  pieCenterShell: isLightTheme
    ? 'border-line/70 bg-white/95 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.16)]'
    : 'border-line/70 bg-panel-subtle/85 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.18)]',
  pieCenterInnerBorder: isLightTheme ? 'border-line/50' : 'border-line/60',
  chartGrid: isLightTheme ? 'rgba(148,163,184,0.22)' : 'rgba(117,134,164,0.16)',
  chartAxisStrong: isLightTheme ? 'rgba(71,85,105,0.78)' : 'rgba(194,205,226,0.72)',
  chartAxisSoft: isLightTheme ? 'rgba(100,116,139,0.76)' : 'rgba(194,205,226,0.58)',
  chartCursorStroke: 'rgba(148,163,184,0.34)',
  chartCursorFill: isLightTheme ? 'rgba(148,163,184,0.08)' : 'rgba(255,255,255,0.03)',
  chartCenterGlow: isLightTheme
    ? 'bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.05),transparent_58%)]'
    : 'bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03),transparent_58%)]',
  pieLabelFill: isLightTheme ? 'rgba(15,23,42,0.84)' : 'rgba(240,245,255,0.92)',
  pieStroke: isLightTheme ? 'rgba(255,255,255,0.96)' : 'rgba(5,10,24,0.72)',
  tableShell: isLightTheme
    ? 'border-line/70 bg-white/92 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.18)]'
    : 'border-white/10 bg-[rgba(5,10,24,0.78)] shadow-[0_26px_90px_-50px_rgba(15,23,42,0.96)]',
  tableHeaderBorder: isLightTheme ? 'border-line/70' : 'border-white/8',
  tableCountBadge: isLightTheme
    ? 'border-line/70 bg-white text-content-secondary'
    : 'border-white/10 bg-white/[0.06] text-content-secondary',
  tablePill: isLightTheme
    ? 'border-line/70 bg-white text-content-secondary'
    : 'border-white/10 bg-white/[0.06] text-content-secondary',
  modalBackdrop: isLightTheme ? 'bg-[rgba(15,23,42,0.38)]' : 'bg-[rgba(1,4,14,0.84)]',
  modalShell: isLightTheme
    ? 'border-line/70 bg-white shadow-[0_30px_90px_-46px_rgba(15,23,42,0.28)]'
    : 'border-white/10 bg-[linear-gradient(135deg,rgba(7,13,32,0.96),rgba(4,8,22,0.96))] shadow-[0_40px_140px_-56px_rgba(15,23,42,0.98)]',
  modalHeaderBorder: isLightTheme ? 'border-line/70' : 'border-white/8',
});

function StatCard({ label, value, note, icon: Icon, accent, theme }) {
  return (
    <div className={`group relative overflow-hidden rounded-[22px] border p-5 backdrop-blur-xl transition duration-300 hover:-translate-y-1 ${theme.statCard}`}>
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{ background: `radial-gradient(circle at 18% 18%, ${accent}33, transparent 34%)` }}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${theme.statLabel}`}>{label}</p>
          <p className={`mt-4 text-3xl font-display font-bold ${theme.statValue}`}>{value}</p>
          <p className={`mt-2 text-sm ${theme.statNote}`}>{note}</p>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-[18px] border ${theme.statIconShell}`}
          style={{ background: theme.statIconBackground(accent) }}
        >
          <Icon size={18} style={{ color: accent }} />
        </div>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, badge, children, theme }) {
  return (
    <section className={`relative overflow-hidden rounded-[24px] border p-5 backdrop-blur-xl sm:p-6 ${theme.panelShell}`}>
      <div className={`pointer-events-none absolute inset-0 ${theme.panelGlow}`} />
      <div className="relative">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="eyebrow">Research Analytics</p>
            <h3 className="mt-2 text-lg font-display font-semibold text-content-primary">{title}</h3>
            <p className="mt-2 text-sm text-content-muted">{subtitle}</p>
          </div>
          {badge ? (
            <span className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${theme.panelBadge}`}>
              {badge}
            </span>
          ) : null}
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </section>
  );
}

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;

  return (
    <div className="chart-tooltip min-w-[12rem]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-content-muted">Year {label}</p>
      <div className="mt-3 space-y-2 text-sm text-content-secondary">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-400 shadow-[0_0_16px_rgba(96,165,250,0.7)]" />
            Papers
          </span>
          <span className="font-semibold text-content-primary">{formatNumber(point?.papers)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.8)]" />
            Citations
          </span>
          <span className="font-semibold text-content-primary">{formatNumber(point?.citations)}</span>
        </div>
      </div>
    </div>
  );
}

function GlowDot({ cx, cy, payload, accent, glow }) {
  if (cx == null || cy == null) return null;
  const isPeak = Boolean(payload?.isPeak);

  return (
    <g>
      <circle cx={cx} cy={cy} r={isPeak ? 16 : 8} fill={glow} opacity={isPeak ? 0.55 : 0.28} />
      <circle cx={cx} cy={cy} r={isPeak ? 5.5 : 3.5} fill={accent} stroke="rgba(7,11,24,0.95)" strokeWidth={2} />
      {isPeak ? (
        <circle cx={cx} cy={cy} r={11} fill="none" stroke={accent} strokeOpacity={0.72} strokeWidth={1.3} />
      ) : null}
    </g>
  );
}

function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;

  return (
    <div className="chart-tooltip min-w-[11rem]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-content-muted">{point?.name}</p>
      <p className="mt-2 text-lg font-semibold text-content-primary">{formatNumber(point?.value)}</p>
      <p className="mt-1 text-xs text-content-secondary">{formatDecimal(point?.percentage)}% of visible papers</p>
    </div>
  );
}

function DepartmentTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;

  return (
    <div className="chart-tooltip min-w-[13rem]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-content-muted">{point?.code}</p>
      <p className="mt-2 text-base font-semibold text-content-primary">{point?.name}</p>
      <div className="mt-3 space-y-2 text-sm text-content-secondary">
        <div className="flex items-center justify-between gap-4">
          <span>Papers</span>
          <span className="font-semibold text-content-primary">{formatNumber(point?.papers)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>Citations</span>
          <span className="font-semibold text-content-primary">{formatNumber(point?.citations)}</span>
        </div>
      </div>
    </div>
  );
}

function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, fill }) {
  if (!percent || percent < 0.12) return null;

  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const angle = (-midAngle * Math.PI) / 180;
  const x = cx + radius * Math.cos(angle);
  const y = cy + radius * Math.sin(angle);

  return (
    <text x={x} y={y} fill={fill} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${Math.round(percent * 100)}%`}
    </text>
  );
}

export default function FacultyResearch() {
  const { user } = useAuth();
  const { isLightTheme } = useTheme();
  const theme = getResearchTheme(isLightTheme);
  const canUpload = user?.role === 'faculty';
  const canViewInstitutionStats = user?.role === 'iqac_admin' || user?.role === 'hod';

  const [allPapers, setAllPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({
    startYear: BASE_YEARS[0],
    endYear: BASE_YEARS[BASE_YEARS.length - 1],
    department: '',
    indexing: '',
    publicationType: '',
  });
  const [form, setForm] = useState(initialForm);

  const loadResearch = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await researchAPI.getAll({ limit: 1000 });
      setAllPapers(response.data.papers || []);
    } catch (error) {
      setAllPapers([]);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Unable to load the research analytics dashboard.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResearch();
  }, [loadResearch]);

  const yearOptions = useMemo(() => {
    const years = new Set([...BASE_YEARS, CURRENT_YEAR]);
    allPapers.forEach((paper) => years.add(Number(paper.year || 0)));
    return Array.from(years).filter((year) => Number.isFinite(year) && year > 0).sort((a, b) => a - b);
  }, [allPapers]);

  const departmentOptions = useMemo(() => {
    const grouped = new Map();

    allPapers.forEach((paper) => {
      const department = getDepartmentMeta(paper);
      const key = department.id || department.code || department.name;

      if (!grouped.has(key)) {
        grouped.set(key, department);
      }
    });

    const options = Array.from(grouped.values());

    return options.sort((left, right) => {
      const leftIndex = FEATURED_DEPARTMENTS.indexOf(left.code);
      const rightIndex = FEATURED_DEPARTMENTS.indexOf(right.code);

      if (leftIndex !== -1 || rightIndex !== -1) {
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
      }

      return left.name.localeCompare(right.name);
    });
  }, [allPapers]);

  const visiblePapers = useMemo(
    () =>
      allPapers.filter((paper) => {
        const year = Number(paper.year || 0);
        const department = getDepartmentMeta(paper);

        if (year < filters.startYear || year > filters.endYear) return false;
        if (filters.department && department.id !== filters.department) return false;
        if (filters.indexing && paper.indexing !== filters.indexing) return false;
        if (filters.publicationType && paper.publicationType !== filters.publicationType) return false;

        return true;
      }),
    [allPapers, filters]
  );

  const trendData = useMemo(
    () => buildTrendData(visiblePapers, filters.startYear, filters.endYear),
    [visiblePapers, filters.startYear, filters.endYear]
  );
  const indexingMix = useMemo(() => buildIndexingMix(visiblePapers), [visiblePapers]);
  const departmentOutput = useMemo(() => buildDepartmentOutput(visiblePapers), [visiblePapers]);
  const peakYear = trendData.find((entry) => entry.isPeak)?.year || null;

  const metrics = useMemo(() => {
    const totalCitations = visiblePapers.reduce((sum, paper) => sum + Number(paper.citations || 0), 0);
    const totalImpact = visiblePapers.reduce((sum, paper) => sum + Number(paper.impactFactor || 0), 0);
    const departmentCount = new Set(
      visiblePapers.map((paper) => getDepartmentMeta(paper).id || getDepartmentMeta(paper).code)
    ).size;

    return {
      totalPapers: visiblePapers.length,
      totalCitations,
      hIndex: calculateHIndex(visiblePapers),
      avgImpact: visiblePapers.length ? totalImpact / visiblePapers.length : 0,
      departmentCount,
    };
  }, [visiblePapers]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      await researchAPI.create({
        ...form,
        year: Number(form.year),
        citations: Number(form.citations || 0),
        impactFactor: Number(form.impactFactor || 0),
        coAuthors: String(form.coAuthors || '')
          .split(',')
          .map((author) => author.trim())
          .filter(Boolean),
      });

      setForm({ ...initialForm, year: CURRENT_YEAR });
      setShowForm(false);
      await loadResearch();
      setMessage({ type: 'success', text: 'Research paper uploaded successfully.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Unable to upload the research paper.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <Navbar
        title="Research Analytics"
        subtitle="A futuristic glass dashboard for publication momentum, citation intelligence, and department-level research output."
        onRefresh={loadResearch}
        loading={loading}
      />

      <div className="dashboard-container flex-1 py-6">
        {message ? (
          <div className={`rounded-[22px] border px-5 py-4 ${message.type === 'success' ? 'border-emerald-400/18 bg-emerald-500/10' : 'border-rose-400/18 bg-rose-500/10'}`}>
            <div className="flex items-center gap-3">
              {message.type === 'success' ? (
                <FilePlus2 size={18} className="text-emerald-300" />
              ) : (
                <AlertTriangle size={18} className="text-rose-300" />
              )}
              <p className="text-sm font-medium text-content-primary">{message.text}</p>
            </div>
          </div>
        ) : null}

        <section className={`relative overflow-hidden rounded-[28px] border p-6 backdrop-blur-xl sm:p-7 ${theme.heroShell}`}>
          <div className={`pointer-events-none absolute inset-0 ${theme.heroGlow}`} />

          <div className="relative flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${theme.heroEyebrow}`}>
                <Sparkles size={13} />
                Research Intelligence Layer
              </span>
              <h2 className={`mt-5 text-3xl font-display font-bold tracking-tight sm:text-[2.35rem] ${theme.heroTitle}`}>
                Premium analytics for publication growth, citation energy, and research quality.
              </h2>
              <p className={`mt-4 max-w-2xl text-sm leading-7 sm:text-[15px] ${theme.heroBody}`}>
                Explore a dark glass dashboard built for academic review cycles, with real filters, export-ready tables, and neon data visualizations designed to feel modern and high signal.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${theme.heroChipBlue}`}>
                  <Filter size={13} />
                  {filters.startYear}-{filters.endYear}
                </span>
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${theme.heroChipGreen}`}>
                  <BookOpen size={13} />
                  {formatNumber(visiblePapers.length)} visible papers
                </span>
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${theme.heroChipViolet}`}>
                  <TrendingUp size={13} />
                  {peakYear ? `Peak ${peakYear}` : 'No peak yet'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn-secondary"
                disabled={!visiblePapers.length}
                onClick={() => downloadCsv(visiblePapers, filters.startYear, filters.endYear)}
              >
                <Download size={16} />
                Export CSV
              </button>
              {canUpload ? (
                <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
                  <FilePlus2 size={16} />
                  Upload Research
                </button>
              ) : null}
            </div>
          </div>

          <div className={`relative mt-8 rounded-[24px] border p-4 sm:p-5 ${theme.filterShell}`}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <label className="block"><span className="metric-label block">Start Year</span><select className="input-field mt-2" value={filters.startYear} onChange={(event) => setFilters((current) => ({ ...current, startYear: Number(event.target.value), endYear: Number(event.target.value) > current.endYear ? Number(event.target.value) : current.endYear }))}>{yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
              <label className="block"><span className="metric-label block">End Year</span><select className="input-field mt-2" value={filters.endYear} onChange={(event) => setFilters((current) => ({ ...current, startYear: Number(event.target.value) < current.startYear ? Number(event.target.value) : current.startYear, endYear: Number(event.target.value) }))}>{yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
              <label className="block"><span className="metric-label block">Department</span><select className="input-field mt-2" value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))}><option value="">All departments</option>{departmentOptions.map((department) => <option key={department.id || department.code} value={department.id}>{department.name}</option>)}</select></label>
              <label className="block"><span className="metric-label block">Indexing</span><select className="input-field mt-2" value={filters.indexing} onChange={(event) => setFilters((current) => ({ ...current, indexing: event.target.value }))}><option value="">All indexing</option>{INDEXING_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label className="block"><span className="metric-label block">Publication Type</span><div className="mt-2 flex gap-3"><select className="input-field flex-1" value={filters.publicationType} onChange={(event) => setFilters((current) => ({ ...current, publicationType: event.target.value }))}><option value="">All types</option>{PUBLICATION_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}</select><button type="button" className="btn-ghost shrink-0" onClick={() => setFilters({ startYear: BASE_YEARS[0], endYear: BASE_YEARS[BASE_YEARS.length - 1], department: '', indexing: '', publicationType: '' })}>Reset</button></div></label>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Papers" value={formatNumber(metrics.totalPapers)} note={`${metrics.departmentCount} departments in scope`} icon={BookOpen} accent="#60a5fa" theme={theme} />
          <StatCard label="Total Citations" value={formatNumber(metrics.totalCitations)} note="Citation movement across visible papers" icon={Sigma} accent="#34d399" theme={theme} />
          <StatCard label="h-index" value={formatNumber(metrics.hIndex)} note="Calculated from the current filtered set" icon={TrendingUp} accent="#c084fc" theme={theme} />
          <StatCard label="Avg Impact Factor" value={formatDecimal(metrics.avgImpact)} note={canViewInstitutionStats ? 'Institution analytics scope' : 'Faculty analytics scope'} icon={Microscope} accent="#f472b6" theme={theme} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
          <Panel
            title="Publication Trend"
            subtitle="Smooth dual-line publication and citation tracking from 2019 through 2024, with layered gradients, soft grids, and a glowing peak marker."
            badge={peakYear ? `Peak ${peakYear}` : 'Awaiting peak'}
            theme={theme}
          >
            {loading ? (
              <div className="skeleton h-[22rem] rounded-[22px]" />
            ) : trendData.length ? (
              <div className="chart-surface relative">
                <ResponsiveContainer width="100%" height={330}>
                  <ComposedChart data={trendData} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="papers-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.28} />
                        <stop offset="55%" stopColor="#2563eb" stopOpacity={0.1} />
                        <stop offset="100%" stopColor="#0f172a" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="citations-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.24} />
                        <stop offset="55%" stopColor="#059669" stopOpacity={0.08} />
                        <stop offset="100%" stopColor="#04140f" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="papers-line" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#7dd3fc" />
                        <stop offset="100%" stopColor="#3b82f6" />
                      </linearGradient>
                      <linearGradient id="citations-line" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#6ee7b7" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={theme.chartGrid} strokeDasharray="4 8" vertical={false} />
                    <XAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={12} tick={{ fill: theme.chartAxisStrong, fontSize: 11, fontWeight: 600 }} />
                    <YAxis yAxisId="papers" tickLine={false} axisLine={false} tickMargin={12} allowDecimals={false} width={40} tick={{ fill: theme.chartAxisSoft, fontSize: 11, fontWeight: 600 }} />
                    <YAxis yAxisId="citations" orientation="right" tickLine={false} axisLine={false} tickMargin={12} allowDecimals={false} width={48} tickFormatter={formatCompactNumber} tick={{ fill: theme.chartAxisSoft, fontSize: 11, fontWeight: 600 }} />
                    <Tooltip cursor={{ stroke: theme.chartCursorStroke, strokeDasharray: '5 6', strokeWidth: 1.2 }} content={<TrendTooltip />} />
                    <Area yAxisId="citations" type="monotone" dataKey="citations" stroke="none" fill="url(#citations-area)" animationDuration={1100} />
                    <Area yAxisId="papers" type="monotone" dataKey="papers" stroke="none" fill="url(#papers-area)" animationDuration={1000} />
                    <Line yAxisId="papers" type="monotone" dataKey="papers" stroke="url(#papers-line)" strokeWidth={3} dot={(props) => <GlowDot {...props} accent="#60a5fa" glow="rgba(96,165,250,0.45)" />} activeDot={(props) => <GlowDot {...props} accent="#60a5fa" glow="rgba(96,165,250,0.56)" />} animationDuration={1200} />
                    <Line yAxisId="citations" type="monotone" dataKey="citations" stroke="url(#citations-line)" strokeWidth={3.1} dot={(props) => <GlowDot {...props} accent="#34d399" glow="rgba(52,211,153,0.55)" />} activeDot={(props) => <GlowDot {...props} accent="#34d399" glow="rgba(52,211,153,0.68)" />} animationDuration={1300} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state min-h-[22rem]">No publications fall inside the current year range and filter combination.</div>
            )}
          </Panel>

          <Panel
            title="Indexing Distribution"
            subtitle="A neon donut distribution of indexing quality, with animated load-in, hover percentages, and a centered total count."
            badge={`${indexingMix.length} buckets`}
            theme={theme}
          >
            {loading ? (
              <div className="skeleton h-[22rem] rounded-[22px]" />
            ) : indexingMix.length ? (
              <div className="grid items-center gap-5 xl:grid-cols-[minmax(18rem,0.86fr)_minmax(0,1.14fr)]">
                <div className="chart-surface relative">
                  <div className={`pointer-events-none absolute inset-0 ${theme.chartCenterGlow}`} />
                  <div className="relative mx-auto aspect-square w-full max-w-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <defs>
                          {indexingMix.map((entry) => (
                            <linearGradient key={entry.name} id={`slice-${entry.name}`} x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor={INDEXING_COLORS[entry.name][0]} />
                              <stop offset="100%" stopColor={INDEXING_COLORS[entry.name][1]} />
                            </linearGradient>
                          ))}
                        </defs>
                        <Tooltip content={<DonutTooltip />} />
                        <Pie data={indexingMix} dataKey="value" nameKey="name" innerRadius={82} outerRadius={122} paddingAngle={3} cornerRadius={18} startAngle={110} endAngle={-250} labelLine={false} label={(props) => <PieLabel {...props} fill={theme.pieLabelFill} />} stroke={theme.pieStroke} strokeWidth={3} animationDuration={1200} animationBegin={120}>
                          {indexingMix.map((entry) => (
                            <Cell key={entry.name} fill={`url(#slice-${entry.name})`} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className={`relative flex h-36 w-36 flex-col items-center justify-center rounded-full border text-center backdrop-blur-xl ${theme.pieCenterShell}`}>
                        <div className={`absolute inset-2 rounded-full border ${theme.pieCenterInnerBorder}`} />
                        <p className="relative text-[10px] font-semibold uppercase tracking-[0.22em] text-content-muted">Indexing Distribution</p>
                        <p className="relative mt-2 text-3xl font-display font-bold text-content-primary">{formatNumber(visiblePapers.length)}</p>
                        <p className="relative mt-1 text-xs text-content-secondary">Visible papers</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  {indexingMix.map((entry) => (
                    <div key={entry.name} className={`group rounded-[20px] border p-4 transition duration-300 hover:-translate-y-0.5 ${theme.indexingCard}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <span className="h-3.5 w-3.5 rounded-full" style={{ background: `linear-gradient(145deg, ${INDEXING_COLORS[entry.name][0]}, ${INDEXING_COLORS[entry.name][1]})`, boxShadow: `0 0 18px ${INDEXING_COLORS[entry.name][0]}55` }} />
                            <div>
                              <p className="text-sm font-semibold text-content-primary">{entry.name}</p>
                              <p className="mt-1 text-xs text-content-muted">{formatNumber(entry.value)} publications</p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-display font-bold text-content-primary">{formatDecimal(entry.percentage)}%</p>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-content-muted">share</p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-3">
                        <div className={`h-2.5 flex-1 overflow-hidden rounded-full p-[1px] ${theme.progressTrack}`}>
                          <div className="h-full rounded-full" style={{ width: `${entry.percentage}%`, background: `linear-gradient(90deg, ${INDEXING_COLORS[entry.name][0]}, ${INDEXING_COLORS[entry.name][1]})`, boxShadow: `0 0 18px ${INDEXING_COLORS[entry.name][0]}44` }} />
                        </div>
                        <span className="min-w-[2.5rem] text-right text-xs font-semibold text-content-secondary">{formatNumber(entry.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state min-h-[22rem]">No indexing distribution is available for the active filters.</div>
            )}
          </Panel>
        </div>

        {canViewInstitutionStats ? (
          <Panel
            title="Department Research Output"
            subtitle="Dual bars for paper volume and citation lift across the major academic departments, with rounded bars, spacing, and value labels."
            badge={`${departmentOutput.length} departments`}
            theme={theme}
          >
            {loading ? (
              <div className="skeleton h-[23rem] rounded-[22px]" />
            ) : departmentOutput.length ? (
              <div className="chart-surface">
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={departmentOutput} barCategoryGap="28%" barGap={10} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="papers-bar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7dd3fc" />
                        <stop offset="100%" stopColor="#2563eb" />
                      </linearGradient>
                      <linearGradient id="citations-bar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6ee7b7" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={theme.chartGrid} strokeDasharray="4 8" vertical={false} />
                    <XAxis dataKey="code" tickLine={false} axisLine={false} tickMargin={12} tick={{ fill: theme.chartAxisStrong, fontSize: 11, fontWeight: 700 }} />
                    <YAxis yAxisId="papers" tickLine={false} axisLine={false} tickMargin={12} allowDecimals={false} width={40} tick={{ fill: theme.chartAxisSoft, fontSize: 11, fontWeight: 600 }} />
                    <YAxis yAxisId="citations" orientation="right" tickLine={false} axisLine={false} tickMargin={12} allowDecimals={false} width={50} tickFormatter={formatCompactNumber} tick={{ fill: theme.chartAxisSoft, fontSize: 11, fontWeight: 600 }} />
                    <Tooltip cursor={{ fill: theme.chartCursorFill }} content={<DepartmentTooltip />} />
                    <Bar yAxisId="papers" dataKey="papers" fill="url(#papers-bar)" radius={[12, 12, 4, 4]} barSize={18} animationDuration={1000}>
                      <LabelList dataKey="papers" position="top" formatter={formatCompactNumber} fill="#2563eb" fontSize={11} fontWeight={700} />
                    </Bar>
                    <Bar yAxisId="citations" dataKey="citations" fill="url(#citations-bar)" radius={[12, 12, 4, 4]} barSize={18} animationDuration={1150}>
                      <LabelList dataKey="citations" position="top" formatter={formatCompactNumber} fill="#059669" fontSize={11} fontWeight={700} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state min-h-[23rem]">Department comparisons will appear once enough research records are available in scope.</div>
            )}
          </Panel>
        ) : null}
        <section className={`overflow-hidden rounded-[24px] border backdrop-blur-xl ${theme.tableShell}`}>
          <div className={`flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6 ${theme.tableHeaderBorder}`}>
            <div>
              <p className="eyebrow">Research Ledger</p>
              <h3 className="mt-2 text-lg font-display font-semibold text-content-primary">Research Papers</h3>
              <p className="mt-2 text-sm text-content-muted">The exact publications backing the dashboard metrics, ready for audit and export.</p>
            </div>
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${theme.tableCountBadge}`}>
              {formatNumber(visiblePapers.length)} loaded
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table min-w-[960px]">
              <thead>
                <tr className="table-head">
                  {['Title', 'Faculty', 'Year', 'Type', 'Indexing', 'Impact', 'Citations'].map((heading) => (
                    <th key={heading} className="table-head-cell">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, rowIndex) => (
                    <tr key={rowIndex} className="table-row">
                      {Array.from({ length: 7 }).map((__, cellIndex) => (
                        <td key={cellIndex} className="table-cell">
                          <div className="skeleton-line w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : visiblePapers.length ? (
                  visiblePapers.map((paper) => (
                    <tr key={paper._id} className="table-row">
                      <td className="table-cell">
                        <p className="font-medium text-content-primary">{paper.title}</p>
                        <p className="mt-1 text-xs text-content-muted">{paper.journal}</p>
                        {paper.doi ? <p className="mt-2 text-xs text-content-secondary">DOI: {paper.doi}</p> : null}
                      </td>
                      <td className="table-cell">
                        <p className="text-content-primary">{paper.faculty?.name || 'Faculty record'}</p>
                        <p className="mt-1 text-xs text-content-muted">{getDepartmentMeta(paper).code}</p>
                      </td>
                      <td className="table-cell">{paper.year}</td>
                      <td className="table-cell"><span className="badge badge-info">{paper.publicationType}</span></td>
                      <td className="table-cell">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${theme.tablePill}`}>
                          {paper.indexing}
                        </span>
                      </td>
                      <td className="table-cell">{formatDecimal(paper.impactFactor)}</td>
                      <td className="table-cell"><span className="font-semibold text-content-primary">{formatNumber(paper.citations)}</span></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="table-cell py-12">
                      <div className="empty-state min-h-[12rem]">No research papers matched the current filter combination.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showForm ? (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md ${theme.modalBackdrop}`}>
          <div className={`w-full max-w-3xl overflow-hidden rounded-[28px] border ${theme.modalShell}`}>
            <div className={`border-b px-5 py-5 sm:px-6 ${theme.modalHeaderBorder}`}>
              <p className="eyebrow">Research Entry</p>
              <h3 className="mt-2 text-xl font-display font-semibold text-content-primary">Upload Research Paper</h3>
              <p className="mt-2 text-sm text-content-muted">Add a new publication into the analytics workspace with indexing, citation, and impact metadata.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5 sm:px-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="metric-label block">Title</span>
                  <input className="input-field mt-2" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
                </label>
                <label className="block">
                  <span className="metric-label block">Journal / Conference</span>
                  <input className="input-field mt-2" value={form.journal} onChange={(event) => setForm((current) => ({ ...current, journal: event.target.value }))} required />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <label className="block">
                  <span className="metric-label block">Year</span>
                  <select className="input-field mt-2" value={form.year} onChange={(event) => setForm((current) => ({ ...current, year: event.target.value }))}>
                    {[...yearOptions].sort((left, right) => right - left).map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="metric-label block">Type</span>
                  <select className="input-field mt-2" value={form.publicationType} onChange={(event) => setForm((current) => ({ ...current, publicationType: event.target.value }))}>
                    {PUBLICATION_TYPES.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="metric-label block">Indexing</span>
                  <select className="input-field mt-2" value={form.indexing} onChange={(event) => setForm((current) => ({ ...current, indexing: event.target.value }))}>
                    {INDEXING_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="metric-label block">Citations</span>
                  <input className="input-field mt-2" type="number" min="0" value={form.citations} onChange={(event) => setForm((current) => ({ ...current, citations: event.target.value }))} />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="metric-label block">DOI</span>
                  <input className="input-field mt-2" value={form.doi} onChange={(event) => setForm((current) => ({ ...current, doi: event.target.value }))} placeholder="10.xxxx/xxxxx" />
                </label>
                <label className="block">
                  <span className="metric-label block">Impact Factor</span>
                  <input className="input-field mt-2" type="number" min="0" step="0.01" value={form.impactFactor} onChange={(event) => setForm((current) => ({ ...current, impactFactor: event.target.value }))} />
                </label>
              </div>

              <label className="block">
                <span className="metric-label block">Co-authors</span>
                <textarea className="textarea-field mt-2 min-h-[7.5rem]" value={form.coAuthors} onChange={(event) => setForm((current) => ({ ...current, coAuthors: event.target.value }))} placeholder="Separate multiple co-authors with commas" />
              </label>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <FilePlus2 size={16} />
                      Save Paper
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
