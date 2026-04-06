import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import Navbar from '../../components/Navbar';
import { staffAPI } from '../../services/api';
import { WorkspaceHeader } from './shared';

const normalizeDepartmentId = (department) => department?._id || department || '';

export default function FacultyManagement() {
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [message, setMessage] = useState(null);
  const [faculty, setFaculty] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [facultyEditor, setFacultyEditor] = useState(null);
  const [filters, setFilters] = useState({ faculty: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [facultyResponse, departmentsResponse] = await Promise.all([
        staffAPI.getFaculty(),
        staffAPI.getDepartments()
      ]);
      setFaculty(facultyResponse.data.faculty || []);
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

  const visibleFaculty = useMemo(
    () => faculty.filter((item) => `${item.name} ${item.email} ${item.department?.code || ''}`.toLowerCase().includes(filters.faculty.toLowerCase())),
    [faculty, filters.faculty]
  );

  const saveFaculty = async () => {
    if (!facultyEditor?._id) return;
    setBusyAction(`faculty-${facultyEditor._id}`);
    setMessage(null);
    try {
      await staffAPI.updateFaculty(facultyEditor._id, {
        department: facultyEditor.department,
        designation: facultyEditor.designation,
        experience: Number(facultyEditor.experience || 0),
        specialization: facultyEditor.specialization,
      });
      setMessage({ type: 'success', text: 'Faculty profile updated.' });
      setFacultyEditor(null);
      await loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Unable to update the faculty profile.' });
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <Navbar title="Faculty Management" subtitle="Refresh designation, specialization, and department alignment." onRefresh={loadData} loading={loading} />
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
          <WorkspaceHeader title="Faculty Info" subtitle="Refresh designation, specialization, and department alignment." badge={`${faculty.length} loaded`} />
          <div className="grid gap-4 px-5 py-5">
            <input className="input-field" placeholder="Search faculty" value={filters.faculty} onChange={(e) => setFilters((current) => ({ ...current, faculty: e.target.value }))} />
            <div className="space-y-3">
              {visibleFaculty.map((member) => (
                <button key={member._id} type="button" className="section-muted w-full p-4 text-left" onClick={() => setFacultyEditor({ ...member, department: normalizeDepartmentId(member.department) })}>
                  <p className="font-semibold text-content-primary">{member.name}</p>
                  <p className="text-xs text-content-muted">{member.designation} · {member.department?.code}</p>
                </button>
              ))}
            </div>
            {facultyEditor ? (
              <div className="section-muted space-y-4 p-4 mt-6">
                <p className="text-sm font-semibold text-content-primary">Editing {facultyEditor.name}</p>
                <select className="input-field" value={facultyEditor.department} onChange={(e) => setFacultyEditor((current) => ({ ...current, department: e.target.value }))}>
                  {departments.map((department) => <option key={department._id} value={department._id}>{department.code}</option>)}
                </select>
                <input className="input-field" value={facultyEditor.designation || ''} onChange={(e) => setFacultyEditor((current) => ({ ...current, designation: e.target.value }))} placeholder="Designation" />
                <input className="input-field" value={facultyEditor.specialization || ''} onChange={(e) => setFacultyEditor((current) => ({ ...current, specialization: e.target.value }))} placeholder="Specialization" />
                <input className="input-field" type="number" value={facultyEditor.experience || 0} onChange={(e) => setFacultyEditor((current) => ({ ...current, experience: e.target.value }))} placeholder="Experience" />
                <div className="flex gap-3">
                  <button type="button" className="btn-primary" onClick={saveFaculty} disabled={busyAction === `faculty-${facultyEditor._id}`}>Save faculty</button>
                  <button type="button" className="btn-secondary" onClick={() => setFacultyEditor(null)}>Cancel</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
