import { useEffect, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { Search, GraduationCap } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { facultyAPI, departmentsAPI } from '../services/api';

const DESIGNATIONS = ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Visiting Faculty'];
const DESIG_COLORS = {
  'Professor': 'badge-info',
  'Associate Professor': 'badge-success',
  'Assistant Professor': 'badge-warning',
  'Lecturer': 'badge-warning',
  'Visiting Faculty': 'text-slate-400 bg-slate-500/10',
};

export default function Faculty() {
  const { user } = useAuth();

  if (user?.role === 'faculty') {
    return <Navigate to="/faculty/overview" replace />;
  }

  return <FacultyDirectory />;
}

function FacultyDirectory() {
  const [faculty, setFaculty] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ search: '', department: '', designation: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...filters, limit: 50 };
      Object.keys(params).forEach(k => !params[k] && delete params[k]);
      const res = await facultyAPI.getAll(params);
      setFaculty(res.data.faculty);
      setTotal(res.data.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    departmentsAPI.getAll().then(r => setDepartments(r.data.departments));
  }, []);

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  return (
    <div className="flex flex-col h-full">
      <Navbar title="Faculty" subtitle={`${total} faculty members`} onRefresh={load} loading={loading} />
      <div className="p-6 space-y-4 flex-1 overflow-y-auto">

        {/* Filters */}
        <div className="card p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="input pl-8 h-9 text-xs" placeholder="Search faculty name..." value={filters.search} onChange={e => setFilter('search', e.target.value)} />
          </div>
          <select className="input h-9 text-xs w-44" value={filters.department} onChange={e => setFilter('department', e.target.value)}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d._id} value={d._id}>{d.code} - {d.name}</option>)}
          </select>
          <select className="input h-9 text-xs w-44" value={filters.designation} onChange={e => setFilter('designation', e.target.value)}>
            <option value="">All Designations</option>
            {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {loading && Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-3">
              <div className="flex gap-3 items-center">
                <div className="w-10 h-10 rounded-full bg-[#1e2738] animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-[#1e2738] rounded animate-pulse w-3/4" />
                  <div className="h-2.5 bg-[#1e2738] rounded animate-pulse w-1/2" />
                </div>
              </div>
            </div>
          ))}

          {!loading && faculty.map(f => (
            <div key={f._id} className="card p-4 hover:border-[#2d3f5e] transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {f.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-200 text-sm truncate">{f.name}</p>
                  <p className="text-xs text-slate-500 truncate">{f.email}</p>
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={`badge text-[10px] ${DESIG_COLORS[f.designation] || 'badge-info'}`}>
                    {f.designation}
                  </span>
                  <span className="badge badge-info text-[10px]">{f.department?.code}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <GraduationCap size={11} />
                  <span>{f.qualification} · {f.experience}y exp</span>
                </div>
                {f.specialization && (
                  <p className="text-xs text-slate-500 truncate">📌 {f.specialization}</p>
                )}
              </div>
            </div>
          ))}

          {!loading && faculty.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500 text-sm">
              No faculty found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
