import os

path = r"e:\Downloads\iqac-system\iqac-system\frontend\src\pages\StaffDashboard.jsx"
with open(path, 'r', encoding='utf-8') as f:
    original = f.read()

old_imports = '''  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  FolderUp,
  GraduationCap,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';'''
new_imports = '''  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Filter,
  FolderUp,
  GraduationCap,
  Loader2,
  RotateCcw,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';'''
if old_imports in original:
    original = original.replace(old_imports, new_imports)
else:
    print("Failed to find old_imports")

old_state = '''  const [filters, setFilters] = useState({
    users: '',
    students: '',
    faculty: '',
    documents: '',
  });'''
new_state = '''  const [filters, setFilters] = useState({
    users: '',
    students: '',
    faculty: '',
    documents: '',
  });
  const [reportFilters, setReportFilters] = useState({
    year: String(CURRENT_YEAR),
    department: 'All',
    reportType: 'All',
  });'''
if old_state in original:
    original = original.replace(old_state, new_state)
else:
    print("Failed to find old_state")

old_preview = '''      const responseMap = {
        department: () => staffAPI.getDepartmentReport(),
        'student-performance': () => staffAPI.getStudentPerformanceReport(),
        'faculty-workload': () => staffAPI.getFacultyWorkloadReport(),
      };'''
new_preview = '''      const responseMap = {
        department: () => staffAPI.getDepartmentReport(reportFilters),
        'student-performance': () => staffAPI.getStudentPerformanceReport(reportFilters),
        'faculty-workload': () => staffAPI.getFacultyWorkloadReport(reportFilters),
      };'''
if old_preview in original:
    original = original.replace(old_preview, new_preview)
else:
    print("Failed to find old_preview")

old_export = '''      const exporters = {
        department: () => staffAPI.exportDepartmentReport({ format }),
        'student-performance': () => staffAPI.exportStudentPerformanceReport({ format }),
        'faculty-workload': () => staffAPI.exportFacultyWorkloadReport({ format }),
      };'''
new_export = '''      const exporters = {
        department: () => staffAPI.exportDepartmentReport({ format, ...reportFilters }),
        'student-performance': () => staffAPI.exportStudentPerformanceReport({ format, ...reportFilters }),
        'faculty-workload': () => staffAPI.exportFacultyWorkloadReport({ format, ...reportFilters }),
      };'''
if old_export in original:
    original = original.replace(old_export, new_export)
else:
    print("Failed to find old_export")

old_panel = '''          <div id="reports-panel" className="section overflow-hidden">
            <WorkspaceHeader title="Reports Panel" subtitle="Preview or export department, student, and faculty workload reports." badge="PDF / CSV" />
            <div className="grid gap-4 px-5 py-5 lg:grid-cols-3">
              {[
                { key: 'department', label: 'Department report', icon: Building2 },
                { key: 'student-performance', label: 'Student performance', icon: GraduationCap },
                { key: 'faculty-workload', label: 'Faculty workload', icon: Users },
              ].map(({ key, label, icon: Icon }) => (
                <div key={key} className="section-muted flex flex-col gap-4 p-5">
                  <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300"><Icon size={18} /></div><div><p className="font-semibold text-content-primary">{label}</p><p className="text-xs text-content-muted">Audit-ready export and preview flow</p></div></div>
                  <div className="grid gap-2">
                    <button type="button" className="btn-secondary justify-center" onClick={() => previewReport(key)} disabled={busyAction === `preview-${key}`}>Preview JSON</button>
                    <button type="button" className="btn-primary justify-center" onClick={() => exportReport(key, 'pdf')} disabled={busyAction === `${key}-pdf`}><Download size={14} /> Export PDF</button>
                    <button type="button" className="btn-secondary justify-center" onClick={() => exportReport(key, 'csv')} disabled={busyAction === `${key}-csv`}><Download size={14} /> Export CSV</button>
                  </div>
                </div>
              ))}
            </div>'''
new_panel = '''          <div id="reports-panel" className="section overflow-hidden">
            <WorkspaceHeader title="Reports Panel" subtitle="Preview or export department, student, and faculty workload reports." badge="PDF / CSV" />
            <div className="border-t border-line/80 px-5 py-5">
              <div className="section rounded-2xl relative overflow-hidden p-0 mb-6 border-line/50 hover:border-line/60 transition-colors">
                <div className="absolute inset-0 bg-gradient-to-tr from-brand-500/5 to-transparent pointer-events-none" />
                <div className="relative p-5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-panel-muted border border-line/50">
                      <Filter size={18} className="text-content-primary" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-content-primary">Global Report Filters</h2>
                      <p className="text-[11px] text-content-muted">Selections apply to all generated reports below</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4 items-end">
                    <div className="space-y-1.5">
                      <label className="metric-label ml-1">Academic Year</label>
                      <select 
                        className="input-field appearance-none cursor-pointer h-10 py-0"
                        value={reportFilters.year} 
                        onChange={(e) => setReportFilters(prev => ({ ...prev, year: e.target.value }))}
                      >
                        <option value="" disabled>Select Year</option>
                        {['2023', '2024', '2025', '2026'].map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="metric-label ml-1">Department</label>
                      <select 
                        className="input-field appearance-none cursor-pointer h-10 py-0"
                        value={reportFilters.department} 
                        onChange={(e) => setReportFilters(prev => ({ ...prev, department: e.target.value }))}
                      >
                        {['All', 'CSE', 'IT', 'ECE', 'Civil', 'Mechanical', 'AI&DS'].map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="metric-label ml-1">Report Type</label>
                      <select 
                        className="input-field appearance-none cursor-pointer h-10 py-0"
                        value={reportFilters.reportType} 
                        onChange={(e) => setReportFilters(prev => ({ ...prev, reportType: e.target.value }))}
                      >
                        {['All', 'Summary', 'Detailed', 'Analytical'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <button 
                        onClick={() => setReportFilters({ year: String(CURRENT_YEAR), department: 'All', reportType: 'All' })} 
                        className="btn-ghost w-full border border-line/80 bg-panel-muted/40 hover:bg-panel-muted hover:border-line-strong/70 h-10 gap-2"
                      >
                        <RotateCcw size={14} />
                        Reset Filters
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {[
                  { key: 'department', label: 'Department report', icon: Building2 },
                  { key: 'student-performance', label: 'Student performance', icon: GraduationCap },
                  { key: 'faculty-workload', label: 'Faculty workload', icon: Users },
                ].map(({ key, label, icon: Icon }) => (
                  <div key={key} className="section-muted flex flex-col gap-5 p-5 transition duration-300 hover:border-brand-500/30 hover:shadow-elevated">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/20">
                        <Icon size={20} className="opacity-90" />
                      </div>
                      <div className="pt-0.5">
                        <p className="text-sm font-semibold text-content-primary mb-0.5">{label}</p>
                        <p className="text-[11px] text-content-muted leading-tight font-medium">Audit-ready export and preview flow</p>
                      </div>
                    </div>
                    <div className="mt-auto grid gap-3">
                      <button type="button" className="btn-secondary w-full justify-center" onClick={() => previewReport(key)} disabled={busyAction === `preview-${key}`}>
                        {busyAction === `preview-${key}` ? <Loader2 size={16} className="animate-spin text-content-primary" /> : null}
                        <span className="font-semibold">Preview JSON</span>
                      </button>
                      <button type="button" className="btn-primary w-full justify-center" onClick={() => exportReport(key, 'pdf')} disabled={busyAction === `${key}-pdf`}>
                        {busyAction === `${key}-pdf` ? <Loader2 size={16} className="animate-spin text-white" /> : <Download size={16} className="text-white/90" />}
                        Export PDF
                      </button>
                      <button type="button" className="btn-secondary w-full justify-center" onClick={() => exportReport(key, 'csv')} disabled={busyAction === `${key}-csv`}>
                        {busyAction === `${key}-csv` ? <Loader2 size={16} className="animate-spin text-content-primary" /> : <Download size={16} className="text-content-muted" />}
                        <span className="font-semibold">Export CSV</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>'''
if old_panel in original:
    original = original.replace(old_panel, new_panel)
else:
    print("Failed to find old_panel")

with open(path, 'w', encoding='utf-8') as f:
    f.write(original)
print("Updated successfully")
