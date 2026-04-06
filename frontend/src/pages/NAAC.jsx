import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Plus,
  Search,
  Sparkles,
  Target,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { naacAPI } from '../services/api';

const CRITERIA = [
  'Curricular Aspects',
  'Teaching-Learning and Evaluation',
  'Research, Consultancy and Extension',
  'Infrastructure and Learning Resources',
  'Student Support and Progression',
  'Governance, Leadership and Management',
  'Innovations and Best Practices',
];

const STATUS_OPTIONS = ['Data Collection', 'Analysis', 'Report Generation', 'Completed'];
const COMPLIANCE_OPTIONS = ['Not Compliant', 'Partially Compliant', 'Compliant', 'Exemplary'];

const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

function MetricCard({ label, value, note, icon: Icon }) {
  return (
    <div className="section card-hover p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="metric-label">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-content-primary">{value}</p>
          <p className="mt-2 text-sm text-content-secondary">{note}</p>
        </div>
        <div className="student-stat-icon student-stat-icon--brand h-11 w-11">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function CriterionFormModal({ criterion, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    academicYear: criterion?.academicYear || '',
    criterion: criterion?.criterion || CRITERIA[0],
    keyIndicator: criterion?.keyIndicator || '',
    metric: criterion?.metric || '',
    description: criterion?.description || '',
    status: criterion?.status || 'Data Collection',
    complianceLevel: criterion?.complianceLevel || 'Not Compliant',
    target: criterion?.quantitativeMetric?.target ?? 0,
    achieved: criterion?.quantitativeMetric?.achieved ?? 0,
    weightage: criterion?.quantitativeMetric?.weightage ?? 1,
    score: criterion?.quantitativeMetric?.score ?? 0,
  });

  const handleSubmit = (event) => {
    event.preventDefault();

    onSubmit({
      academicYear: formData.academicYear,
      criterion: formData.criterion,
      keyIndicator: formData.keyIndicator,
      metric: formData.metric,
      description: formData.description,
      status: formData.status,
      complianceLevel: formData.complianceLevel,
      quantitativeMetric: {
        target: Number(formData.target),
        achieved: Number(formData.achieved),
        weightage: Number(formData.weightage),
        score: Number(formData.score),
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="section w-full max-w-3xl p-0" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-line/70 px-6 py-5">
          <div>
            <p className="eyebrow">NAAC Management</p>
            <h3 className="mt-2 text-xl font-semibold text-content-primary">
              {criterion ? 'Edit criterion' : 'Create criterion'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>

        <form className="space-y-5 px-6 py-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="metric-label block">Academic Year</span>
              <input
                className="input-field mt-2"
                placeholder="2025-26"
                value={formData.academicYear}
                onChange={(event) => setFormData((current) => ({ ...current, academicYear: event.target.value }))}
                required
              />
            </label>
            <label className="block">
              <span className="metric-label block">Criterion</span>
              <select
                className="input-field mt-2"
                value={formData.criterion}
                onChange={(event) => setFormData((current) => ({ ...current, criterion: event.target.value }))}
              >
                {CRITERIA.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="metric-label block">Key Indicator</span>
              <input
                className="input-field mt-2"
                value={formData.keyIndicator}
                onChange={(event) => setFormData((current) => ({ ...current, keyIndicator: event.target.value }))}
                required
              />
            </label>
            <label className="block">
              <span className="metric-label block">Metric</span>
              <input
                className="input-field mt-2"
                value={formData.metric}
                onChange={(event) => setFormData((current) => ({ ...current, metric: event.target.value }))}
                required
              />
            </label>
          </div>

          <label className="block">
            <span className="metric-label block">Description</span>
            <textarea
              className="textarea-field mt-2 min-h-[7rem]"
              value={formData.description}
              onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="metric-label block">Target</span>
              <input
                type="number"
                className="input-field mt-2"
                value={formData.target}
                onChange={(event) => setFormData((current) => ({ ...current, target: event.target.value }))}
              />
            </label>
            <label className="block">
              <span className="metric-label block">Achieved</span>
              <input
                type="number"
                className="input-field mt-2"
                value={formData.achieved}
                onChange={(event) => setFormData((current) => ({ ...current, achieved: event.target.value }))}
              />
            </label>
            <label className="block">
              <span className="metric-label block">Weightage</span>
              <input
                type="number"
                className="input-field mt-2"
                value={formData.weightage}
                onChange={(event) => setFormData((current) => ({ ...current, weightage: event.target.value }))}
              />
            </label>
            <label className="block">
              <span className="metric-label block">Score</span>
              <input
                type="number"
                className="input-field mt-2"
                value={formData.score}
                onChange={(event) => setFormData((current) => ({ ...current, score: event.target.value }))}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="metric-label block">Status</span>
              <select
                className="input-field mt-2"
                value={formData.status}
                onChange={(event) => setFormData((current) => ({ ...current, status: event.target.value }))}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="metric-label block">Compliance</span>
              <select
                className="input-field mt-2"
                value={formData.complianceLevel}
                onChange={(event) => setFormData((current) => ({ ...current, complianceLevel: event.target.value }))}
              >
                {COMPLIANCE_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex justify-end gap-3 border-t border-line/70 pt-5">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {criterion ? 'Update criterion' : 'Create criterion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DataPointModal({
  criterion,
  onClose,
  onSubmit,
  title = 'Add data point',
  nameLabel = 'Name',
  valueLabel = 'Value',
  valuePlaceholder = '',
}) {
  const [formData, setFormData] = useState({
    name: '',
    value: '',
    unit: '',
    source: '',
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      ...formData,
      value: Number(formData.value),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="section w-full max-w-lg p-0" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-line/70 px-6 py-5">
          <p className="eyebrow">NAAC Actions</p>
          <h3 className="mt-2 text-xl font-semibold text-content-primary">{title}</h3>
          <p className="mt-2 text-sm text-content-secondary">{criterion?.metric}</p>
        </div>
        <form className="space-y-4 px-6 py-6" onSubmit={handleSubmit}>
          <label className="block">
            <span className="metric-label block">{nameLabel}</span>
            <input
              className="input-field mt-2"
              value={formData.name}
              onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </label>
          <label className="block">
            <span className="metric-label block">{valueLabel}</span>
            <input
              type="number"
              className="input-field mt-2"
              value={formData.value}
              onChange={(event) => setFormData((current) => ({ ...current, value: event.target.value }))}
              placeholder={valuePlaceholder}
              required
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="metric-label block">Unit</span>
              <input
                className="input-field mt-2"
                value={formData.unit}
                onChange={(event) => setFormData((current) => ({ ...current, unit: event.target.value }))}
              />
            </label>
            <label className="block">
              <span className="metric-label block">Source</span>
              <input
                className="input-field mt-2"
                value={formData.source}
                onChange={(event) => setFormData((current) => ({ ...current, source: event.target.value }))}
              />
            </label>
          </div>
          <div className="flex justify-end gap-3 border-t border-line/70 pt-5">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const getComplianceBadgeClass = (status) => {
  if (status === 'Exemplary') return 'badge badge-success';
  if (status === 'Compliant') return 'badge badge-info';
  if (status === 'Partially Compliant') return 'badge badge-warning';
  return 'badge badge-danger';
};

export default function NAAC() {
  const { user } = useAuth();
  const [criteria, setCriteria] = useState([]);
  const [dashboard, setDashboard] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    academicYear: '',
    criterion: '',
    status: '',
    search: '',
  });
  const [flashMessage, setFlashMessage] = useState(null);
  const [editingCriterion, setEditingCriterion] = useState(null);
  const [showCriterionModal, setShowCriterionModal] = useState(false);
  const [dataPointCriterion, setDataPointCriterion] = useState(null);
  const [reviewCriterion, setReviewCriterion] = useState(null);

  const canManage = user?.role === 'iqac_admin';
  const canReview = user?.role === 'hod';

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const params = { ...filters };
      Object.keys(params).forEach((key) => !params[key] && delete params[key]);

      const [criteriaResponse, dashboardResponse] = await Promise.all([
        naacAPI.getCriteria(params),
        naacAPI.getDashboard(filters.academicYear ? { academicYear: filters.academicYear } : {}),
      ]);

      setCriteria(criteriaResponse.data.criteria || []);
      setDashboard(dashboardResponse.data.dashboard || {});
    } catch (error) {
      console.error('Unable to load NAAC workspace:', error);
      setCriteria([]);
      setDashboard({});
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleCriteria = useMemo(() => {
    if (!filters.search) {
      return criteria;
    }

    const query = filters.search.toLowerCase();
    return criteria.filter((criterion) =>
      [criterion.keyIndicator, criterion.metric, criterion.description]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [criteria, filters.search]);

  const metricCards = [
    {
      label: 'Total Criteria',
      value: loading ? '--' : dashboard.totalCriteria ?? 0,
      note: 'Criteria currently tracked in the accreditation workspace',
      icon: ClipboardList,
    },
    {
      label: 'Overall Compliance',
      value: loading ? '--' : formatPercent(dashboard.overallCompliance || 0),
      note: 'Combined compliant and exemplary coverage',
      icon: CheckCircle2,
    },
    {
      label: 'Average Score',
      value: loading ? '--' : Number(dashboard.avgScore || 0).toFixed(2),
      note: 'Average quantitative score across visible criteria',
      icon: BarChart3,
    },
    {
      label: 'Exemplary',
      value: loading ? '--' : dashboard.complianceLevels?.Exemplary || 0,
      note: 'Criteria already meeting exemplary expectations',
      icon: Target,
    },
  ];

  const handleCriterionSubmit = async (payload) => {
    try {
      if (editingCriterion?._id) {
        await naacAPI.updateCriterion(editingCriterion._id, payload);
      } else {
        await naacAPI.createCriterion(payload);
      }

      setShowCriterionModal(false);
      setEditingCriterion(null);
      setFlashMessage({
        type: 'success',
        text: editingCriterion ? 'NAAC criterion updated successfully.' : 'NAAC criterion created successfully.',
      });
      await load();
    } catch (error) {
      setFlashMessage({
        type: 'error',
        text: error.response?.data?.message || 'Unable to save the NAAC criterion.',
      });
    }
  };

  const handleDataPointSubmit = async (payload) => {
    try {
      await naacAPI.addDataPoint(dataPointCriterion._id, payload);
      setDataPointCriterion(null);
      setFlashMessage({
        type: 'success',
        text: 'NAAC data point saved successfully.',
      });
      await load();
    } catch (error) {
      setFlashMessage({
        type: 'error',
        text: error.response?.data?.message || 'Unable to save the data point.',
      });
    }
  };

  const handleReviewSubmit = async (payload) => {
    try {
      await naacAPI.addReview(reviewCriterion._id, {
        review: payload.name,
        rating: Number(payload.value),
      });
      setReviewCriterion(null);
      setFlashMessage({
        type: 'success',
        text: 'NAAC review added successfully.',
      });
      await load();
    } catch (error) {
      setFlashMessage({
        type: 'error',
        text: error.response?.data?.message || 'Unable to save the review.',
      });
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <Navbar
        title="NAAC Accreditation"
        subtitle="Criteria tracking, compliance health, and evidence readiness"
        onRefresh={load}
        loading={loading}
      />

      <div className="dashboard-container flex-1">
        {flashMessage ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              flashMessage.type === 'success'
                ? 'border-success/25 bg-success/10 text-success'
                : 'border-danger/25 bg-danger/10 text-danger'
            }`}
          >
            {flashMessage.text}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((card) => (
            <MetricCard key={card.label} {...card} />
          ))}
        </div>

        <section className="section space-y-5">
          <div className="toolbar">
            <div>
              <p className="eyebrow">Filters</p>
              <h2 className="mt-1 text-xl font-semibold text-content-primary">Accreditation control panel</h2>
              <p className="section-subtitle mt-1">
                Filter NAAC readiness by academic year, criterion, and progress stage.
              </p>
            </div>

            {canManage ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setEditingCriterion(null);
                  setShowCriterionModal(true);
                }}
              >
                <Plus size={15} />
                Add Criterion
              </button>
            ) : (
              <span className="badge badge-info">
                <Sparkles size={12} />
                Review Mode
              </span>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(10rem,0.45fr))]">
            <label className="relative min-w-0">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
              <input
                className="input-field pl-9"
                placeholder="Search key indicators, metrics, or descriptions"
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              />
            </label>

            <input
              className="input-field"
              placeholder="Academic year"
              value={filters.academicYear}
              onChange={(event) => setFilters((current) => ({ ...current, academicYear: event.target.value }))}
            />

            <select
              className="input-field"
              value={filters.criterion}
              onChange={(event) => setFilters((current) => ({ ...current, criterion: event.target.value }))}
            >
              <option value="">All Criteria</option>
              {CRITERIA.map((criterion) => (
                <option key={criterion} value={criterion}>
                  {criterion}
                </option>
              ))}
            </select>

            <select
              className="input-field"
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {loading ? (
            <>
              <div className="skeleton min-h-[16rem] rounded-[24px]" />
              <div className="skeleton min-h-[16rem] rounded-[24px]" />
            </>
          ) : visibleCriteria.length ? (
            visibleCriteria.map((criterion) => (
              <article key={criterion._id} className="section overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line/70 px-5 py-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge badge-info">{criterion.academicYear}</span>
                      <span className={getComplianceBadgeClass(criterion.complianceLevel)}>
                        {criterion.complianceLevel}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-content-primary">{criterion.metric}</h3>
                    <p className="mt-1 text-sm text-content-secondary">{criterion.keyIndicator}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {canManage ? (
                      <>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setEditingCriterion(criterion);
                            setShowCriterionModal(true);
                          }}
                        >
                          Edit
                        </button>
                        <button type="button" className="btn-primary" onClick={() => setDataPointCriterion(criterion)}>
                          Add Data
                        </button>
                      </>
                    ) : null}
                    {canReview ? (
                      <button type="button" className="btn-secondary" onClick={() => setReviewCriterion(criterion)}>
                        Add Review
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 px-5 py-5">
                  <p className="text-sm leading-7 text-content-secondary">
                    {criterion.description || 'Criterion description is not available yet.'}
                  </p>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="surface-inset p-4">
                      <p className="metric-label">Target</p>
                      <p className="mt-2 text-xl font-semibold text-content-primary">{criterion.quantitativeMetric?.target ?? 0}</p>
                    </div>
                    <div className="surface-inset p-4">
                      <p className="metric-label">Achieved</p>
                      <p className="mt-2 text-xl font-semibold text-content-primary">{criterion.quantitativeMetric?.achieved ?? 0}</p>
                    </div>
                    <div className="surface-inset p-4">
                      <p className="metric-label">Weightage</p>
                      <p className="mt-2 text-xl font-semibold text-content-primary">{criterion.quantitativeMetric?.weightage ?? 1}</p>
                    </div>
                    <div className="surface-inset p-4">
                      <p className="metric-label">Score</p>
                      <p className="mt-2 text-xl font-semibold text-content-primary">{criterion.quantitativeMetric?.score ?? 0}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="badge badge-warning">{criterion.criterion}</span>
                    <span className="badge badge-info">{criterion.status}</span>
                    <span className="badge badge-success">{criterion.dataPoints?.length || 0} data points</span>
                    <span className="badge badge-info">{criterion.documents?.length || 0} documents</span>
                    <span className="badge badge-warning">{criterion.reviewers?.length || 0} reviews</span>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state min-h-[16rem] xl:col-span-2">No NAAC criteria matched the selected filters.</div>
          )}
        </section>
      </div>

      {showCriterionModal ? (
        <CriterionFormModal
          criterion={editingCriterion}
          onClose={() => {
            setShowCriterionModal(false);
            setEditingCriterion(null);
          }}
          onSubmit={handleCriterionSubmit}
        />
      ) : null}

      {dataPointCriterion ? (
        <DataPointModal
          criterion={dataPointCriterion}
          onClose={() => setDataPointCriterion(null)}
          onSubmit={handleDataPointSubmit}
          title="Add data point"
        />
      ) : null}

      {reviewCriterion ? (
        <DataPointModal
          criterion={reviewCriterion}
          onClose={() => setReviewCriterion(null)}
          onSubmit={handleReviewSubmit}
          title="Add review"
          nameLabel="Review"
          valueLabel="Rating"
          valuePlaceholder="1 to 5"
        />
      ) : null}
    </div>
  );
}
