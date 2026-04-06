import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import Navbar from '../../components/Navbar';
import { adminAPI, staffAPI } from '../../services/api';
import { WorkspaceHeader } from './shared';

const ROLE_OPTIONS = [
  { value: 'hod', label: 'HOD' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'student', label: 'Student' },
];

const CURRENT_YEAR = new Date().getFullYear();
const BATCH_YEAR_OPTIONS = Array.from({ length: 8 }, (_, index) => CURRENT_YEAR - index);

const clampSemester = (value) => Math.min(Math.max(Number(value || 1), 1), 8);

const getDerivedCurrentSemester = (batchYear) => {
  const normalizedBatchYear = Number(batchYear);
  if (!normalizedBatchYear) return 1;
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const academicStartYear = month >= 6 ? year : year - 1;
  if (normalizedBatchYear > academicStartYear) return 1;
  const yearsElapsed = academicStartYear - normalizedBatchYear;
  return clampSemester(yearsElapsed * 2 + (month >= 6 ? 1 : 2));
};

const getAcademicYearLabel = (batchYear, semester) => {
  const normalizedBatchYear = Number(batchYear) || CURRENT_YEAR;
  const startYear = normalizedBatchYear + Math.floor((clampSemester(semester) - 1) / 2);
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
};

const buildSemesterCgpaEntries = (batchYear, existingEntries = []) => {
  const derivedSemester = getDerivedCurrentSemester(batchYear);
  return Array.from({ length: derivedSemester }, (_, index) => {
    const semester = index + 1;
    const existing = existingEntries.find((entry) => Number(entry.semester) === semester);
    return {
      semester,
      academicYear: getAcademicYearLabel(batchYear, semester),
      cgpa: existing?.cgpa ?? '',
    };
  });
};

const getLatestSemesterCgpa = (entries = []) => {
  const validEntries = entries
    .map((entry) => ({ ...entry, cgpa: Number(entry.cgpa) }))
    .filter((entry) => Number.isFinite(entry.cgpa))
    .sort((left, right) => left.semester - right.semester);
  return validEntries.length > 0 ? validEntries[validEntries.length - 1].cgpa : 0;
};

const initialUserForm = {
  name: '',
  email: '',
  role: 'faculty',
  department: '',
  password: '',
  designation: 'Assistant Professor',
  qualification: 'MTech',
  experience: '0',
  rollNumber: '',
  batchYear: CURRENT_YEAR,
  currentSemester: '1',
  phone: '',
  semesterCgpa: buildSemesterCgpaEntries(CURRENT_YEAR),
};

const generateTemporaryPassword = () => {
  const lower = Math.random().toString(36).slice(-4);
  const upper = Math.random().toString(36).slice(-4).toUpperCase();
  const suffix = String(Date.now()).slice(-2);
  return `${upper}${lower}${suffix}!`;
};

export default function UserManagement() {
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [message, setMessage] = useState(null);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [userForm, setUserForm] = useState(initialUserForm);
  const [filters, setFilters] = useState({ users: '' });
  const [passwordReset, setPasswordReset] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersResponse, departmentsResponse] = await Promise.all([
        staffAPI.getUsers(),
        staffAPI.getDepartments()
      ]);
      setUsers(usersResponse.data.users || []);
      setDepartments(departmentsResponse.data.departments || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (userForm.role !== 'student') return;
    setUserForm((current) => ({
      ...current,
      currentSemester: String(getDerivedCurrentSemester(current.batchYear)),
      semesterCgpa: buildSemesterCgpaEntries(current.batchYear, current.semesterCgpa),
    }));
  }, [userForm.role, userForm.batchYear]);

  const visibleUsers = useMemo(
    () => users.filter((item) => `${item.name} ${item.email} ${item.role}`.toLowerCase().includes(filters.users.toLowerCase())),
    [filters.users, users]
  );

  const studentCurrentSemester = useMemo(
    () => getDerivedCurrentSemester(userForm.batchYear),
    [userForm.batchYear]
  );

  const studentOverallCgpa = useMemo(
    () => getLatestSemesterCgpa(userForm.semesterCgpa),
    [userForm.semesterCgpa]
  );

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setBusyAction('create-user');
    setMessage(null);

    const payload = {
      ...userForm,
      department: userForm.department || undefined,
      experience: Number(userForm.experience || 0),
      batchYear: Number(userForm.batchYear || 0),
      currentSemester: studentCurrentSemester,
      cgpa: studentOverallCgpa,
    };

    if (payload.role !== 'student') {
      delete payload.rollNumber;
      delete payload.batchYear;
      delete payload.currentSemester;
      delete payload.cgpa;
      delete payload.semesterCgpa;
    }

    if (payload.role === 'student') {
      delete payload.designation;
      delete payload.qualification;
      delete payload.experience;
      payload.academicRecords = {
        semesterCgpa: (userForm.semesterCgpa || [])
          .map((entry) => ({
            semester: entry.semester,
            academicYear: entry.academicYear,
            cgpa: entry.cgpa === '' ? null : Number(entry.cgpa),
          }))
          .filter((entry) => Number.isFinite(entry.cgpa)),
      };
    } else {
      delete payload.academicRecords;
    }

    try {
      const response = await staffAPI.createUser(payload);
      const defaultPassword = response.data.data?.defaultPassword;
      setMessage({
        type: 'success',
        text: defaultPassword
          ? `Account created. Temporary password: ${defaultPassword}`
          : 'Account created successfully.',
      });
      setUserForm(initialUserForm);
      await loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Unable to create the account.' });
    } finally {
      setBusyAction('');
    }
  };

  const handleDisableUser = async (id) => {
    setBusyAction(`disable-${id}`);
    setMessage(null);
    try {
      await staffAPI.disableUser(id);
      setMessage({ type: 'success', text: 'Account disabled successfully.' });
      await loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Unable to disable that account.' });
    } finally {
      setBusyAction('');
    }
  };

  const openPasswordReset = (user) => {
    setPasswordReset({
      userId: user.id || user._id,
      userName: user.name,
      password: generateTemporaryPassword(),
    });
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();

    if (!passwordReset?.userId) {
      return;
    }

    setBusyAction(`reset-${passwordReset.userId}`);
    setMessage(null);

    try {
      await adminAPI.resetUserPassword(passwordReset.userId, {
        password: passwordReset.password,
      });
      setMessage({
        type: 'success',
        text: `Password reset for ${passwordReset.userName}. Temporary password: ${passwordReset.password}`,
      });
      setPasswordReset(null);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Unable to reset that password.',
      });
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <Navbar title="User Management" subtitle="Create accounts, review profile links, and disable inactive users." onRefresh={loadData} loading={loading} />
      <div className="dashboard-container flex-1 py-6">
        {message ? (
          <div className={`section mb-6 px-5 py-4 ${message.type === 'success' ? 'border-success/40 bg-success/10' : 'border-danger/40 bg-danger/10'}`}>
            <div className="flex items-center gap-3">
              {message.type === 'success' ? <CheckCircle2 size={18} className="text-success" /> : <AlertTriangle size={18} className="text-danger" />}
              <p className="text-sm font-medium text-content-primary">{message.text}</p>
            </div>
          </div>
        ) : null}

        <div className="section overflow-hidden">
          <WorkspaceHeader title="User Management" subtitle="Create accounts, review profile links, and disable inactive users." badge={`${users.length} loaded`} />
          <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(22rem,1fr)_minmax(0,1.15fr)]">
            <form className="section-muted min-w-0 space-y-4 p-5" onSubmit={handleCreateUser}>
              <div className="min-w-0">
                <label className="metric-label block leading-tight">Full name</label>
                <input className="input-field mt-2" value={userForm.name} onChange={(e) => setUserForm((current) => ({ ...current, name: e.target.value }))} required />
              </div>
              <div className="min-w-0">
                <label className="metric-label block leading-tight">Email</label>
                <input className="input-field mt-2" type="email" value={userForm.email} onChange={(e) => setUserForm((current) => ({ ...current, email: e.target.value }))} required />
              </div>
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(10.5rem,1fr))]">
                <div className="min-w-0">
                  <label className="metric-label block leading-tight">Role</label>
                  <select className="input-field mt-2" value={userForm.role} onChange={(e) => setUserForm((current) => ({ ...current, role: e.target.value }))}>{ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select>
                </div>
                <div className="min-w-0">
                  <label className="metric-label block leading-tight">Department</label>
                  <select className="input-field mt-2" value={userForm.department} onChange={(e) => setUserForm((current) => ({ ...current, department: e.target.value }))}><option value="">Select department</option>{departments.map((department) => <option key={department._id} value={department._id}>{department.code} - {department.name}</option>)}</select>
                </div>
              </div>
              {userForm.role === 'student' ? (
                <div className="space-y-4">
                  <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(8.5rem,1fr))]">
                    <div className="min-w-0"><label className="metric-label block leading-tight">Roll number</label><input className="input-field mt-2" value={userForm.rollNumber} onChange={(e) => setUserForm((current) => ({ ...current, rollNumber: e.target.value }))} required /></div>
                    <div className="min-w-0"><label className="metric-label block leading-tight">Batch year</label><select className="input-field mt-2" value={userForm.batchYear} onChange={(e) => setUserForm((current) => ({ ...current, batchYear: Number(e.target.value) }))}>{BATCH_YEAR_OPTIONS.map((year) => <option key={year} value={year}>{year}</option>)}</select></div>
                    <div className="min-w-0"><label className="metric-label block leading-tight">Current semester</label><input className="input-field mt-2" value={`Semester ${studentCurrentSemester}`} readOnly /></div>
                  </div>
                  <div className="section-muted space-y-4 p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-content-primary">Semester-wise CGPA</p>
                        <p className="text-xs text-content-muted">Generated from the selected batch year up to the current semester.</p>
                      </div>
                      <div className="badge badge-info">Overall CGPA {studentOverallCgpa.toFixed(2)}</div>
                    </div>
                    <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))]">
                      {(userForm.semesterCgpa || []).map((entry, index) => (
                        <div key={`${entry.semester}-${entry.academicYear}`} className="min-w-0">
                          <label className="metric-label block leading-tight">{`Sem ${entry.semester} (${entry.academicYear})`}</label>
                          <input
                            className="input-field mt-2"
                            type="number"
                            min="0"
                            max="10"
                            step="0.01"
                            value={entry.cgpa}
                            placeholder="CGPA"
                            onChange={(e) => setUserForm((current) => ({
                              ...current,
                              semesterCgpa: current.semesterCgpa.map((currentEntry, currentIndex) => currentIndex === index ? { ...currentEntry, cgpa: e.target.value } : currentEntry),
                            }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(8.5rem,1fr))]">
                  <div className="min-w-0"><label className="metric-label block leading-tight">Designation</label><input className="input-field mt-2" value={userForm.designation} onChange={(e) => setUserForm((current) => ({ ...current, designation: e.target.value }))} /></div>
                  <div className="min-w-0"><label className="metric-label block leading-tight">Qualification</label><input className="input-field mt-2" value={userForm.qualification} onChange={(e) => setUserForm((current) => ({ ...current, qualification: e.target.value }))} /></div>
                  <div className="min-w-0"><label className="metric-label block leading-tight">Experience</label><input className="input-field mt-2" type="number" value={userForm.experience} onChange={(e) => setUserForm((current) => ({ ...current, experience: e.target.value }))} /></div>
                </div>
              )}
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(10.5rem,1fr))]">
                <div className="min-w-0"><label className="metric-label block leading-tight">Phone</label><input className="input-field mt-2" value={userForm.phone} onChange={(e) => setUserForm((current) => ({ ...current, phone: e.target.value }))} /></div>
                <div className="min-w-0"><label className="metric-label block leading-tight">Custom password</label><input className="input-field mt-2" type="text" value={userForm.password} onChange={(e) => setUserForm((current) => ({ ...current, password: e.target.value }))} placeholder="Optional password" /></div>
              </div>
              <button type="submit" className="btn-primary w-full justify-center" disabled={busyAction === 'create-user'}>{busyAction === 'create-user' ? 'Creating account...' : 'Create account'}</button>
            </form>

            <div className="space-y-4">
              <div className="toolbar"><input className="input-field flex-1" placeholder="Search users" value={filters.users} onChange={(e) => setFilters((current) => ({ ...current, users: e.target.value }))} /></div>
              <div className="table-shell">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead><tr className="table-head">{['User', 'Role', 'Status', 'Action'].map((heading) => <th key={heading} className="table-head-cell">{heading}</th>)}</tr></thead>
                    <tbody>
                      {visibleUsers.map((item) => (
                        <tr key={item.id || item._id} className="table-row">
                          <td className="table-cell"><p className="font-medium text-content-primary">{item.name}</p><p className="text-xs text-content-muted">{item.email}</p></td>
                          <td className="table-cell text-xs uppercase tracking-[0.18em] text-content-secondary">{item.role}</td>
                          <td className="table-cell"><span className={`badge ${item.isActive ? 'badge-success' : 'badge-warning'}`}>{item.isActive ? 'Active' : 'Disabled'}</span></td>
                          <td className="table-cell">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="btn-secondary text-xs"
                                onClick={() => openPasswordReset(item)}
                                disabled={item.role === 'iqac_admin' || busyAction === `reset-${item.id || item._id}`}
                              >
                                Reset PW
                              </button>
                              <button
                                type="button"
                                className="btn-secondary text-xs"
                                onClick={() => handleDisableUser(item.id || item._id)}
                                disabled={!item.isActive || busyAction === `disable-${item.id || item._id}` || item.role === 'iqac_admin'}
                              >
                                {!item.isActive ? 'Disabled' : 'Disable'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {passwordReset ? (
        <PasswordResetModal
          value={passwordReset}
          busy={busyAction === `reset-${passwordReset.userId}`}
          onChange={(password) => setPasswordReset((current) => ({ ...current, password }))}
          onSubmit={handleResetPassword}
          onClose={() => setPasswordReset(null)}
        />
      ) : null}
    </div>
  );
}

function PasswordResetModal({ value, busy, onChange, onSubmit, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card w-full max-w-md">
        <div className="border-b border-line/80 px-5 py-4">
          <h3 className="text-lg font-semibold text-content-primary">Reset Password</h3>
          <p className="mt-1 text-sm text-content-muted">
            Set a new temporary password for {value.userName}.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 px-5 py-5">
          <div>
            <label className="metric-label block">Temporary password</label>
            <input
              className="input-field mt-2"
              value={value.password}
              minLength={6}
              onChange={(event) => onChange(event.target.value)}
              required
            />
          </div>

          <div className="surface-inset p-4 text-xs text-content-muted">
            Share this password securely with the user after resetting it.
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy || value.password.length < 6}>
              {busy ? 'Resetting...' : 'Reset password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
