import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, Plus, Edit, TrendingUp, Target, BarChart3 } from 'lucide-react';
import Navbar from '../components/Navbar';
import { nbaAPI, departmentsAPI } from '../services/api';

const CRITERIA_TYPES = [
  'Vision', 'Mission', 'PEO', 'PO', 'PSO', 'CO', 'Curriculum', 
  'Assessment', 'Facilities', 'Faculty', 'StudentPerformance', 'ContinuousImprovement'
];

export default function NBA() {
  const [criteria, setCriteria] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    program: '', academicYear: '', criteria: '', status: '',
  });
  const [showForm, setShowForm] = useState(false);
  const [editingCriterion, setEditingCriterion] = useState(null);
  const [showMeasurement, setShowMeasurement] = useState(false);
  const [selectedCriterion, setSelectedCriterion] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      Object.keys(params).forEach(k => !params[k] && delete params[k]);
      const res = await nbaAPI.getCriteria(params);
      setCriteria(res.data.criteria);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filters]);

  const loadDashboard = useCallback(async () => {
    try {
      const params = { ...filters };
      Object.keys(params).forEach(k => !params[k] && delete params[k]);
      const res = await nbaAPI.getDashboard(params);
      setDashboard(res.data.dashboard);
    } catch (e) { console.error(e); }
  }, [filters]);

  useEffect(() => { 
    load(); 
    loadDashboard(); 
  }, [load, loadDashboard]);

  useEffect(() => {
    departmentsAPI.getAll().then(r => setDepartments(r.data.departments));
  }, []);

  const setFilter = (k, v) => {
    setFilters(f => ({ ...f, [k]: v }));
  };

  const handleAddMeasurement = (criterion) => {
    setSelectedCriterion(criterion);
    setShowMeasurement(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      'Not Started': 'badge-danger',
      'In Progress': 'badge-warning',
      'Met': 'badge-success',
      'Not Met': 'badge-danger',
      'Exceeded': 'badge-info',
    };
    return colors[status] || 'badge-info';
  };

  const getComplianceColor = (score) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="flex flex-col h-full">
      <Navbar 
        title="NBA Accreditation" 
        subtitle="OBE Criteria Tracking & Compliance" 
        onRefresh={load} 
        loading={loading} 
      />

      <div className="p-6 space-y-4 flex-1 overflow-y-auto">
        {/* Filters */}
        <div className="card p-4 flex flex-wrap gap-3 items-center">
          <select className="input h-9 text-xs w-40" value={filters.program} onChange={e => setFilter('program', e.target.value)}>
            <option value="">All Programs</option>
            {departments.map(d => <option key={d._id} value={d._id}>{d.code}</option>)}
          </select>

          <select className="input h-9 text-xs w-36" value={filters.academicYear} onChange={e => setFilter('academicYear', e.target.value)}>
            <option value="">All Years</option>
            <option value="2023-24">2023-24</option>
            <option value="2022-23">2022-23</option>
            <option value="2021-22">2021-22</option>
          </select>

          <select className="input h-9 text-xs w-44" value={filters.criteria} onChange={e => setFilter('criteria', e.target.value)}>
            <option value="">All Criteria</option>
            {CRITERIA_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select className="input h-9 text-xs w-36" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
            <option value="">All Status</option>
            <option value="Not Started">Not Started</option>
            <option value="In Progress">In Progress</option>
            <option value="Met">Met</option>
            <option value="Not Met">Not Met</option>
            <option value="Exceeded">Exceeded</option>
          </select>

          <button
            onClick={() => setShowForm(true)}
            className="btn-primary h-9 px-4 flex items-center gap-2"
          >
            <Plus size={14} /> Add Criterion
          </button>
        </div>

        {/* Dashboard Overview */}
        {dashboard && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <CheckCircle size={18} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Criteria</p>
                  <p className="text-xl font-display font-bold text-white">{dashboard.totalCriteria}</p>
                </div>
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <TrendingUp size={18} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Met Criteria</p>
                  <p className="text-xl font-display font-bold text-white">{dashboard.metCriteria}</p>
                </div>
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-500/15 flex items-center justify-center">
                  <Target size={18} className="text-brand-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Compliance %</p>
                  <p className="text-xl font-display font-bold text-white">{dashboard.overallCompliance}%</p>
                </div>
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center">
                  <BarChart3 size={18} className="text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Avg Score</p>
                  <p className="text-xl font-display font-bold text-white">{dashboard.avgComplianceScore}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Criteria List */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1e2738]">
            <h3 className="text-sm font-semibold text-white">NBA Criteria</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e2738]">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Criteria</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Title</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Target</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Actual</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Score</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2738]">
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="h-3 bg-[#1e2738] rounded animate-pulse w-20" />
                      </td>
                    ))}
                  </tr>
                ))}

                {!loading && criteria.map(criterion => (
                  <tr key={criterion._id} className="hover:bg-[#161b27] transition-colors">
                    <td className="px-5 py-3">
                      <span className="badge badge-info text-[10px]">{criterion.criteria}</span>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-200 text-sm">{criterion.title}</p>
                      <p className="text-xs text-slate-500">{criterion.program?.code}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-display font-bold text-slate-300">{criterion.targetValue}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-display font-bold text-slate-300">{criterion.actualValue}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`font-display font-bold ${getComplianceColor(criterion.complianceScore)}`}>
                        {criterion.complianceScore}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge text-[10px] ${getStatusColor(criterion.status)}`}>
                        {criterion.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAddMeasurement(criterion)}
                          className="btn-ghost h-7 px-3 text-xs flex items-center gap-1"
                        >
                          <Plus size={11} /> Add Data
                        </button>
                        <button
                          onClick={() => {
                            setEditingCriterion(criterion);
                            setShowForm(true);
                          }}
                          className="btn-ghost h-7 p-0"
                        >
                          <Edit size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!loading && criteria.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-slate-500 text-sm">
                      No NBA criteria found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Criterion Form Modal */}
      {showForm && (
        <NBACriterionForm
          criterion={editingCriterion}
          departments={departments}
          onSubmit={async (formData) => {
            try {
              if (editingCriterion) {
                await nbaAPI.updateCriterion(editingCriterion._id, formData);
              } else {
                await nbaAPI.createCriterion(formData);
              }
              setShowForm(false);
              setEditingCriterion(null);
              load();
              loadDashboard();
            } catch (e) {
              console.error('Error saving criterion:', e);
            }
          }}
          onClose={() => {
            setShowForm(false);
            setEditingCriterion(null);
          }}
        />
      )}

      {/* Measurement Form Modal */}
      {showMeasurement && selectedCriterion && (
        <MeasurementForm
          criterion={selectedCriterion}
          onSubmit={async (measurementData) => {
            try {
              await nbaAPI.addMeasurement(selectedCriterion._id, measurementData);
              setShowMeasurement(false);
              setSelectedCriterion(null);
              load();
              loadDashboard();
            } catch (e) {
              console.error('Error adding measurement:', e);
            }
          }}
          onClose={() => {
            setShowMeasurement(false);
            setSelectedCriterion(null);
          }}
        />
      )}
    </div>
  );
}

// NBA Criterion Form Component
function NBACriterionForm({ criterion, departments, onSubmit, onClose }) {
  const [formData, setFormData] = useState({
    criteria: criterion?.criteria || 'Vision',
    title: criterion?.title || '',
    description: criterion?.description || '',
    targetValue: criterion?.targetValue || 0,
    threshold: criterion?.threshold || 60,
    unit: criterion?.unit || 'Percentage',
    program: criterion?.program?._id || '',
    academicYear: criterion?.academicYear || '2023-24',
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
            {criterion ? 'Edit NBA Criterion' : 'Add NBA Criterion'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Criteria Type *</label>
              <select
                className="input"
                value={formData.criteria}
                onChange={e => setFormData({ ...formData, criteria: e.target.value })}
                required
              >
                {CRITERIA_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Academic Year *</label>
              <select
                className="input"
                value={formData.academicYear}
                onChange={e => setFormData({ ...formData, academicYear: e.target.value })}
                required
              >
                <option value="2023-24">2023-24</option>
                <option value="2022-23">2022-23</option>
                <option value="2021-22">2021-22</option>
              </select>
            </div>
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
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Target Value *</label>
              <input
                type="number"
                className="input"
                value={formData.targetValue}
                onChange={e => setFormData({ ...formData, targetValue: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Threshold</label>
              <input
                type="number"
                className="input"
                value={formData.threshold}
                onChange={e => setFormData({ ...formData, threshold: parseFloat(e.target.value) || 0 })}
                min="0"
                max="100"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">Unit</label>
              <select
                className="input"
                value={formData.unit}
                onChange={e => setFormData({ ...formData, unit: e.target.value })}
              >
                <option value="Percentage">Percentage</option>
                <option value="Number">Number</option>
                <option value="Rating">Rating</option>
                <option value="Score">Score</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Program</label>
            <select
              className="input"
              value={formData.program}
              onChange={e => setFormData({ ...formData, program: e.target.value })}
            >
              <option value="">Select Program</option>
              {departments.map(d => <option key={d._id} value={d._id}>{d.code}</option>)}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#1e2738]">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {criterion ? 'Update' : 'Create'} Criterion
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Measurement Form Component
function MeasurementForm({ criterion, onSubmit, onClose }) {
  const [formData, setFormData] = useState({
    value: '',
    remarks: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-[#1e2738]">
          <h3 className="text-lg font-semibold text-white">Add Measurement</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">
              {criterion.title} ({criterion.unit})
            </label>
            <input
              type="number"
              className="input"
              value={formData.value}
              onChange={e => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
              placeholder={`Enter value in ${criterion.unit}`}
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1.5">Remarks</label>
            <textarea
              className="input h-16 resize-none"
              value={formData.remarks}
              onChange={e => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Add any observations or comments..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#1e2738]">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Add Measurement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
