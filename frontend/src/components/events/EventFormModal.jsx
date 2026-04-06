import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Layers3, Sparkles, X } from 'lucide-react';

const EVENT_TYPES = ['Technical', 'Cultural', 'Sports', 'Workshop', 'Seminar', 'Competition', 'Hackathon', 'Conference', 'Social'];
const LEVELS = ['International', 'National', 'State', 'Regional', 'Institutional'];

const getInitialState = (allowAllDepartments, lockedDepartment) => ({
  title: '',
  description: '',
  type: 'Technical',
  level: 'Institutional',
  startDate: '',
  endDate: '',
  location: '',
  organizingBody: '',
  department: lockedDepartment?._id || (allowAllDepartments ? 'ALL' : ''),
});

export default function EventFormModal({
  departments,
  onClose,
  onSubmit,
  submitting = false,
  allowAllDepartments = true,
  lockedDepartment = null,
}) {
  const [formData, setFormData] = useState(() => getInitialState(allowAllDepartments, lockedDepartment));

  useEffect(() => {
    setFormData(getInitialState(allowAllDepartments, lockedDepartment));
  }, [allowAllDepartments, lockedDepartment]);

  const departmentOptions = useMemo(() => {
    const items = departments.map((department) => ({
      value: department._id,
      label: `${department.code} - ${department.name}`,
    }));

    return allowAllDepartments
      ? [{ value: 'ALL', label: 'All Departments' }, ...items]
      : items;
  }, [allowAllDepartments, departments]);

  const handleSubmit = (event) => {
    event.preventDefault();

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      type: formData.type,
      level: formData.level,
      startDate: formData.startDate,
      endDate: formData.endDate,
      location: formData.location.trim(),
      organizingBody: formData.organizingBody.trim(),
      departmentScope: formData.department === 'ALL' ? 'ALL' : 'DEPARTMENT',
    };

    if (payload.departmentScope === 'DEPARTMENT') {
      payload.department = lockedDepartment?._id || formData.department;
    }

    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="section w-full max-w-3xl p-0" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-line/80 px-6 py-5">
          <div>
            <p className="eyebrow">Admin Event Setup</p>
            <h2 className="mt-1 text-2xl font-semibold text-content-primary">Create Event</h2>
            <p className="mt-2 text-sm text-content-secondary">
              Publish a department-specific or institution-wide event with clean scheduling and visibility rules.
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost h-10 w-10 p-0" aria-label="Close event form">
            <X size={18} />
          </button>
        </div>

        <form className="space-y-5 px-6 py-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="section-muted p-4">
              <p className="metric-label">Publishing Mode</p>
              <p className="mt-2 flex items-center gap-2 text-sm font-medium text-content-primary">
                <Layers3 size={15} className="text-brand-200" />
                {lockedDepartment
                  ? `${lockedDepartment.code} department event`
                  : allowAllDepartments
                    ? 'Department or all-department visibility'
                    : 'Department-scoped visibility'}
              </p>
            </div>
            <div className="section-muted p-4">
              <p className="metric-label">Experience Goal</p>
              <p className="mt-2 flex items-center gap-2 text-sm font-medium text-content-primary">
                <Sparkles size={15} className="text-brand-200" />
                Premium event cards, student registration, and participant tracking
              </p>
            </div>
          </div>

          <div className="grid gap-5">
            <label className="min-w-0">
              <span className="metric-label block">Event Title</span>
              <input
                className="input-field mt-2"
                value={formData.title}
                onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
                required
              />
            </label>

            <label className="min-w-0">
              <span className="metric-label block">Description</span>
              <textarea
                className="textarea-field mt-2 min-h-[8rem]"
                value={formData.description}
                onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
              />
            </label>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="min-w-0">
                <span className="metric-label block">Type</span>
                <select
                  className="input-field mt-2"
                  value={formData.type}
                  onChange={(event) => setFormData((current) => ({ ...current, type: event.target.value }))}
                >
                  {EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>

              <label className="min-w-0">
                <span className="metric-label block">Level</span>
                <select
                  className="input-field mt-2"
                  value={formData.level}
                  onChange={(event) => setFormData((current) => ({ ...current, level: event.target.value }))}
                >
                  {LEVELS.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="min-w-0">
                <span className="metric-label block">Start Date</span>
                <div className="relative mt-2">
                  <CalendarRange size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                  <input
                    type="date"
                    className="input-field pl-10"
                    value={formData.startDate}
                    onChange={(event) => setFormData((current) => ({ ...current, startDate: event.target.value }))}
                    required
                  />
                </div>
              </label>

              <label className="min-w-0">
                <span className="metric-label block">End Date</span>
                <div className="relative mt-2">
                  <CalendarRange size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
                  <input
                    type="date"
                    className="input-field pl-10"
                    value={formData.endDate}
                    onChange={(event) => setFormData((current) => ({ ...current, endDate: event.target.value }))}
                    required
                  />
                </div>
              </label>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="min-w-0">
                <span className="metric-label block">Location</span>
                <input
                  className="input-field mt-2"
                  value={formData.location}
                  onChange={(event) => setFormData((current) => ({ ...current, location: event.target.value }))}
                />
              </label>

              <label className="min-w-0">
                <span className="metric-label block">Department Visibility</span>
                <select
                  className="input-field mt-2"
                  value={formData.department}
                  onChange={(event) => setFormData((current) => ({ ...current, department: event.target.value }))}
                  disabled={Boolean(lockedDepartment)}
                >
                  {!lockedDepartment ? <option value="">Select Department</option> : null}
                  {departmentOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="min-w-0">
              <span className="metric-label block">Organizing Body</span>
              <input
                className="input-field mt-2"
                value={formData.organizingBody}
                onChange={(event) => setFormData((current) => ({ ...current, organizingBody: event.target.value }))}
              />
            </label>
          </div>

          <div className="flex flex-col gap-3 border-t border-line/80 pt-5 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="btn-secondary justify-center">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (!formData.department && !lockedDepartment)}
              className="btn-primary justify-center"
            >
              {submitting ? 'Publishing...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
