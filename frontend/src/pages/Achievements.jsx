import { useEffect, useState, useCallback } from 'react';
import { Search, Trophy, Award, Calendar, Plus, Edit, Trash2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import { achievementsAPI, departmentsAPI, facultyAPI } from '../services/api';

const ACHIEVEMENT_TYPES = ['Award', 'Certification', 'Recognition', 'Publication', 'Grant', 'Patent', 'Conference', 'Workshop', 'FDP'];
const LEVELS = ['International', 'National', 'State', 'Institutional'];
const CATEGORIES = ['Academic', 'Research', 'Teaching', 'Service', 'Professional Development'];

export default function Achievements() {
  const [achievements, setAchievements] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: '', department: '', type: '', level: '', academicYear: '',
  });
  const [showForm, setShowForm] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState(null);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT, ...filters };
      Object.keys(params).forEach(k => !params[k] && delete params[k]);
      const res = await achievementsAPI.getAll(params);
      setAchievements(res.data.achievements);
      setTotal(res.data.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    departmentsAPI.getAll().then(r => setDepartments(r.data.departments));
    facultyAPI.getAll({ limit: 200 }).then(r => setFaculty(r.data.faculty));
  }, []);

  const setFilter = (k, v) => {
    setFilters(f => ({ ...f, [k]: v }));
    setPage(1);
  };

  const handleSubmit = async (formData) => {
    try {
      if (editingAchievement) {
        await achievementsAPI.update(editingAchievement._id, formData);
      } else {
        await achievementsAPI.create(formData);
      }
      setShowForm(false);
      setEditingAchievement(null);
      load();
    } catch (e) {
      console.error('Error saving achievement:', e);
    }
  };

  const handleEdit = (achievement) => {
    setEditingAchievement(achievement);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this achievement?')) {
      try {
        await achievementsAPI.delete(id);
        load();
      } catch (e) {
        console.error('Error deleting achievement:', e);
      }
    }
  };

  const getTypeColor = (type) => {
    const colors = {
      'Award': 'badge-warning',
      'Certification': 'badge-info',
      'Recognition': 'badge-success',
      'Publication': 'badge-danger',
      'Grant': 'badge-warning',
      'Patent': 'badge-info',
      'Conference': 'badge-success',
      'Workshop': 'badge-warning',
      'FDP': 'badge-info',
    };
    return colors[type] || 'badge-info';
  };

  const getLevelColor = (level) => {
    const colors = {
      'International': 'badge-danger',
      'National': 'badge-warning',
      'State': 'badge-info',
      'Institutional': 'badge-success',
    };
    return colors[level] || 'badge-info';
  };

  return (
    <div className="flex flex-col h-full">
      <Navbar 
        title="Faculty Achievements" 
        subtitle={`${total} achievements`} 
        onRefresh={load} 
        loading={loading} 
      />

      <div className="p-6 space-y-4 flex-1 overflow-y-auto">
        {/* Filters */}
        <div className="card p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input pl-8 h-9 text-xs"
              placeholder="Search achievements..."
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)}
            />
          </div>

          <select className="input h-9 text-xs w-40" value={filters.department} onChange={e => setFilter('department', e.target.value)}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d._id} value={d._id}>{d.code}</option>)}
          </select>

          <select className="input h-9 text-xs w-36" value={filters.type} onChange={e => setFilter('type', e.target.value)}>
            <option value="">All Types</option>
            {ACHIEVEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <select className="input h-9 text-xs w-36" value={filters.level} onChange={e => setFilter('level', e.target.value)}>
            <option value="">All Levels</option>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>

          <button
            onClick={() => setShowForm(true)}
            className="btn-primary h-9 px-4 flex items-center gap-2"
          >
            <Plus size={14} /> Add Achievement
          </button>
        </div>

        {/* Achievement Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading && Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-3">
              <div className="h-4 bg-[#1e2738] rounded animate-pulse w-3/4" />
              <div className="space-y-2">
                <div className="h-3 bg-[#1e2738] rounded animate-pulse" />
                <div className="h-3 bg-[#1e2738] rounded animate-pulse w-5/6" />
              </div>
            </div>
          ))}

          {!loading && achievements.map(achievement => (
            <div key={achievement._id} className="card p-4 hover:border-[#2d3f5e] transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-brand-500/15 flex items-center justify-center">
                    <Trophy size={16} className="text-brand-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-200 text-sm line-clamp-2">{achievement.title}</p>
                    <p className="text-xs text-slate-500">{achievement.issuingOrganization}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(achievement)}
                    className="p-1.5 rounded hover:bg-[#1c2336] text-slate-400 hover:text-slate-200"
                  >
                    <Edit size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(achievement._id)}
                    className="p-1.5 rounded hover:bg-red-500/15 text-slate-400 hover:text-red-400"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`badge text-[10px] ${getTypeColor(achievement.type)}`}>
                    {achievement.type}
                  </span>
                  <span className={`badge text-[10px] ${getLevelColor(achievement.level)}`}>
                    {achievement.level}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Calendar size={11} />
                  <span>{new Date(achievement.date).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>{achievement.faculty?.name}</span>
                </div>

                {achievement.description && (
                  <p className="text-xs text-slate-400 line-clamp-2">{achievement.description}</p>
                )}

                {achievement.points > 0 && (
                  <div className="flex items-center gap-1">
                    <Award size={11} className="text-amber-400" />
                    <span className="text-xs font-medium text-amber-400">{achievement.points} points</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {!loading && achievements.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500 text-sm">
              No achievements found.
            </div>
          )}
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-slate-500">
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost h-8 w-8 p-0 flex items-center justify-center disabled:opacity-30"
              >
                ←
              </button>
              <span className="text-xs text-slate-400">Page {page}</span>
              <button
                onClick={() => setPage(p => Math.min(Math.ceil(total / LIMIT), p + 1))}
                disabled={page >= Math.ceil(total / LIMIT)}
                className="btn-ghost h-8 w-8 p-0 flex items-center justify-center disabled:opacity-30"
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Achievement Form Modal */}
      {showForm && (
        <AchievementForm
          achievement={editingAchievement}
          departments={departments}
          faculty={faculty}
          onSubmit={handleSubmit}
          onClose={() => {
            setShowForm(false);
            setEditingAchievement(null);
          }}
        />
      )}
    </div>
  );
}

// Achievement Form Component
function AchievementForm({ achievement, departments, faculty, onSubmit, onClose }) {
  const [formData, setFormData] = useState({
    faculty: achievement?.faculty?._id || '',
    title: achievement?.title || '',
    description: achievement?.description || '',
    type: achievement?.type || 'Award',
    level: achievement?.level || 'Institutional',
    category: achievement?.category || 'Academic',
    issuingOrganization: achievement?.issuingOrganization || '',
    date: achievement?.date ? new Date(achievement.date).toISOString().split('T')[0] : '',
    department: achievement?.department?._id || '',
    points: achievement?.points || 0,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#1e2738]">
          <h3 className="text-lg font-semibold text-white">
            {achievement ? 'Edit Achievement' : 'Add Achievement'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Faculty *</label>
              <select
                className="input"
                value={formData.faculty}
                onChange={e => setFormData({ ...formData, faculty: e.target.value })}
                required
              >
                <option value="">Select Faculty</option>
                {faculty.map(member => (
                  <option key={member._id} value={member._id}>
                    {member.name} {member.department?.code ? `(${member.department.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Title *</label>
              <input
                className="input"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Organization *</label>
            <input
              className="input"
              value={formData.issuingOrganization}
              onChange={e => setFormData({ ...formData, issuingOrganization: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Description</label>
            <textarea
              className="input h-20 resize-none"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Type</label>
              <select
                className="input"
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value })}
              >
                {ACHIEVEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Level</label>
              <select
                className="input"
                value={formData.level}
                onChange={e => setFormData({ ...formData, level: e.target.value })}
              >
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Points</label>
              <input
                type="number"
                className="input"
                value={formData.points}
                onChange={e => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
                min="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Date *</label>
              <input
                type="date"
                className="input"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Department</label>
              <select
                className="input"
                value={formData.department}
                onChange={e => setFormData({ ...formData, department: e.target.value })}
              >
                <option value="">Select Department</option>
                {departments.map(d => <option key={d._id} value={d._id}>{d.code}</option>)}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#1e2738]">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {achievement ? 'Update' : 'Create'} Achievement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
