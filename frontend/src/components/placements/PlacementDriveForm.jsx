import { useEffect, useMemo, useState } from 'react';
import { Briefcase, CalendarRange, Sparkles } from 'lucide-react';

const statusOptions = ['Open', 'Upcoming', 'Closed'];

const getDateInputValue = (value) => {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
};

const buildInitialState = (editingDrive, lockedDepartment) => ({
  company: editingDrive?.company || '',
  role: editingDrive?.role || '',
  package: editingDrive?.package ?? '',
  location: editingDrive?.location || '',
  academicYear: editingDrive?.academicYear || '',
  minCgpa: editingDrive?.minCgpa ?? 0,
  maxBacklogs: editingDrive?.maxBacklogs ?? 0,
  deadline: getDateInputValue(editingDrive?.deadline),
  driveDate: getDateInputValue(editingDrive?.driveDate),
  description: editingDrive?.description || '',
  status: editingDrive?.status || 'Upcoming',
  departments: lockedDepartment
    ? [lockedDepartment._id]
    : (editingDrive?.departments || []).map((department) => department._id || department),
});

export default function PlacementDriveForm({
  departments,
  editingDrive,
  lockedDepartment = null,
  onCancel,
  onSubmit,
  resetToken = 0,
  submitting = false,
}) {
  const [formData, setFormData] = useState(() => buildInitialState(editingDrive, lockedDepartment));
  const [useAllDepartments, setUseAllDepartments] = useState(
    !lockedDepartment && (!editingDrive?.departments || editingDrive.departments.length === 0)
  );

  useEffect(() => {
    setFormData(buildInitialState(editingDrive, lockedDepartment));
    setUseAllDepartments(
      !lockedDepartment && (!editingDrive?.departments || editingDrive.departments.length === 0)
    );
  }, [editingDrive, lockedDepartment, resetToken]);

  const title = editingDrive ? 'Update placement drive' : 'Create placement drive';
  const submitLabel = editingDrive ? 'Save drive' : 'Publish drive';
  const departmentSelectionDisabled = Boolean(lockedDepartment) || useAllDepartments;

  const selectedDepartmentSummary = useMemo(() => {
    if (lockedDepartment) {
      return `${lockedDepartment.code} - ${lockedDepartment.name}`;
    }

    if (useAllDepartments) {
      return 'Visible to all departments';
    }

    if (!formData.departments.length) {
      return 'Choose at least one department';
    }

    return `${formData.departments.length} department${formData.departments.length > 1 ? 's' : ''} selected`;
  }, [formData.departments.length, lockedDepartment, useAllDepartments]);

  const handleDepartmentChange = (event) => {
    const values = Array.from(event.target.selectedOptions).map((option) => option.value);
    setFormData((current) => ({
      ...current,
      departments: values,
    }));
  };

  const handleReset = () => {
    setFormData(buildInitialState(null, lockedDepartment));
    setUseAllDepartments(!lockedDepartment);
    onCancel?.();
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const payload = {
      ...formData,
      package: Number(formData.package),
      minCgpa: Number(formData.minCgpa),
      maxBacklogs: Number(formData.maxBacklogs),
      departments: lockedDepartment
        ? [lockedDepartment._id]
        : useAllDepartments
          ? []
          : formData.departments,
    };

    onSubmit(payload);
  };

  return (
    <section className="section overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-line/70 px-5 py-4">
        <div>
          <p className="eyebrow">Drive Operations</p>
          <h3 className="mt-2 text-lg font-semibold text-content-primary">{title}</h3>
          <p className="mt-2 text-sm text-content-secondary">
            Publish eligibility, dates, and department reach from a structured admin form.
          </p>
        </div>
        {editingDrive ? (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel edit
          </button>
        ) : null}
      </div>

      <form className="space-y-5 px-5 py-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="section-muted p-4">
            <p className="metric-label">Drive Reach</p>
            <p className="mt-2 flex items-center gap-2 text-sm font-medium text-content-primary">
              <Briefcase size={15} className="text-brand-200" />
              {selectedDepartmentSummary}
            </p>
          </div>
          <div className="section-muted p-4">
            <p className="metric-label">Workflow</p>
            <p className="mt-2 flex items-center gap-2 text-sm font-medium text-content-primary">
              <Sparkles size={15} className="text-brand-200" />
              Students are notified automatically when an active drive is published.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="metric-label block">Company</span>
            <input
              className="input-field mt-2"
              value={formData.company}
              onChange={(event) => setFormData((current) => ({ ...current, company: event.target.value }))}
              required
            />
          </label>

          <label className="block">
            <span className="metric-label block">Role</span>
            <input
              className="input-field mt-2"
              value={formData.role}
              onChange={(event) => setFormData((current) => ({ ...current, role: event.target.value }))}
              required
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="metric-label block">Package (LPA)</span>
            <input
              type="number"
              min="0"
              step="0.1"
              className="input-field mt-2"
              value={formData.package}
              onChange={(event) => setFormData((current) => ({ ...current, package: event.target.value }))}
              required
            />
          </label>

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
            <span className="metric-label block">Min CGPA</span>
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              className="input-field mt-2"
              value={formData.minCgpa}
              onChange={(event) => setFormData((current) => ({ ...current, minCgpa: event.target.value }))}
            />
          </label>

          <label className="block">
            <span className="metric-label block">Max Backlogs</span>
            <input
              type="number"
              min="0"
              className="input-field mt-2"
              value={formData.maxBacklogs}
              onChange={(event) => setFormData((current) => ({ ...current, maxBacklogs: event.target.value }))}
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="block">
            <span className="metric-label block">Drive Date</span>
            <div className="relative mt-2">
              <CalendarRange size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
              <input
                type="date"
                className="input-field pl-10"
                value={formData.driveDate}
                onChange={(event) => setFormData((current) => ({ ...current, driveDate: event.target.value }))}
                required
              />
            </div>
          </label>

          <label className="block">
            <span className="metric-label block">Deadline</span>
            <div className="relative mt-2">
              <CalendarRange size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
              <input
                type="date"
                className="input-field pl-10"
                value={formData.deadline}
                onChange={(event) => setFormData((current) => ({ ...current, deadline: event.target.value }))}
                required
              />
            </div>
          </label>

          <label className="block">
            <span className="metric-label block">Status</span>
            <select
              className="input-field mt-2"
              value={formData.status}
              onChange={(event) => setFormData((current) => ({ ...current, status: event.target.value }))}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="metric-label block">Location</span>
            <input
              className="input-field mt-2"
              value={formData.location}
              onChange={(event) => setFormData((current) => ({ ...current, location: event.target.value }))}
            />
          </label>

          <div className="space-y-3">
            {!lockedDepartment ? (
              <label className="flex items-center gap-3 rounded-2xl border border-line/70 bg-panel-muted/50 px-4 py-3 text-sm text-content-secondary">
                <input
                  type="checkbox"
                  checked={useAllDepartments}
                  onChange={(event) => setUseAllDepartments(event.target.checked)}
                />
                Open this drive to all departments
              </label>
            ) : null}

            <label className="block">
              <span className="metric-label block">Departments</span>
              <select
                multiple
                className="input-field mt-2 min-h-[8rem]"
                value={formData.departments}
                onChange={handleDepartmentChange}
                disabled={departmentSelectionDisabled}
              >
                {departments.map((department) => (
                  <option key={department._id} value={department._id}>
                    {department.code} - {department.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <label className="block">
          <span className="metric-label block">Description</span>
          <textarea
            className="textarea-field mt-2 min-h-[7rem]"
            value={formData.description}
            onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
          />
        </label>

        <div className="flex flex-col gap-3 border-t border-line/70 pt-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={handleReset} className="btn-secondary justify-center">
            Clear
          </button>
          <button
            type="submit"
            className="btn-primary justify-center"
            disabled={submitting || (!useAllDepartments && !lockedDepartment && !formData.departments.length)}
          >
            {submitting ? 'Saving...' : submitLabel}
          </button>
        </div>
      </form>
    </section>
  );
}
