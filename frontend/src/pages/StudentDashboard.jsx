import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpenCheck, Briefcase, FileStack, GraduationCap, Save } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { API_ORIGIN, studentPortalAPI } from '../services/api';
import SubjectsPerformance from '../components/student/SubjectsPerformance';
import AttendanceAnalytics from '../components/student/AttendanceAnalytics';
import BacklogTracker from '../components/student/BacklogTracker';
import StudentAchievements from '../components/student/StudentAchievements';
import StudentFeedback from '../components/student/StudentFeedback';
import StudentDocuments from '../components/student/StudentDocuments';
import PlacementPortal from '../components/student/PlacementPortal';

const getSettledPayload = (result, fallback) => {
  if (result.status === 'fulfilled') {
    return result.value.data?.data ?? fallback;
  }

  return fallback;
};

export default function StudentDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [banner, setBanner] = useState('');
  const [profile, setProfile] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [backlogs, setBacklogs] = useState(null);
  const [achievements, setAchievements] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [documents, setDocuments] = useState(null);
  const [placements, setPlacements] = useState(null);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', address: '', gender: '' });

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setBanner('');

    const results = await Promise.allSettled([
      studentPortalAPI.getProfile(),
      studentPortalAPI.getAttendance(),
      studentPortalAPI.getBacklogs(),
      studentPortalAPI.getAchievements(),
      studentPortalAPI.getFeedback(),
      studentPortalAPI.getDocuments(),
      studentPortalAPI.getPlacements(),
    ]);

    const profilePayload = getSettledPayload(results[0], null);
    setProfile(profilePayload?.student || null);
    setAttendance(getSettledPayload(results[1], null));
    setBacklogs(getSettledPayload(results[2], null));
    setAchievements(getSettledPayload(results[3], null));
    setFeedback(getSettledPayload(results[4], null));
    setDocuments(getSettledPayload(results[5], null));
    setPlacements(getSettledPayload(results[6], null));

    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length) {
      setBanner(failures[0].reason?.response?.data?.message || 'Some student modules could not be loaded.');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (profile) {
      setProfileForm({
        name: profile.name || '',
        phone: profile.phone || '',
        address: profile.address || '',
        gender: profile.gender || '',
      });
    }
  }, [profile]);

  const runAction = useCallback(async (key, action) => {
    setBusyAction(key);
    setBanner('');

    try {
      await action();
      await loadDashboard();
      return { success: true };
    } catch (error) {
      setBanner(error.response?.data?.message || error.message || 'Unable to complete the action.');
      return { success: false };
    } finally {
      setBusyAction('');
    }
  }, [loadDashboard]);

  const saveProfile = () => runAction('profile', () => studentPortalAPI.updateProfile(profileForm));
  const submitAchievement = (payload) => runAction('achievement', () => studentPortalAPI.createAchievement(payload));
  const submitFeedback = (payload) => runAction('feedback', () => studentPortalAPI.createFeedback(payload));
  const submitDocument = (payload) => runAction('document', () => studentPortalAPI.createDocument(payload));
  const applyToPlacement = (payload) => runAction('placement', () => studentPortalAPI.applyToPlacement(payload));

  const summaryCards = useMemo(() => {
    const currentSemester = profile?.currentSemester || 1;
    const year = Math.ceil(currentSemester / 2);

    return [
      {
        label: 'Current CGPA',
        value: Number(profile?.cgpa || 0).toFixed(2),
        note: `Year ${year} · Semester ${currentSemester}`,
        icon: GraduationCap,
        tone: 'brand',
      },
      {
        label: 'Overall Attendance',
        value: `${Number(attendance?.overall?.percentage || 0).toFixed(2)}%`,
        note: `${attendance?.overall?.warningCount || 0} warnings`,
        icon: BookOpenCheck,
        tone: 'info',
      },
      {
        label: 'Active Backlogs',
        value: backlogs?.summary?.currentBacklogs || 0,
        note: `${backlogs?.summary?.totalBacklogsCleared || 0} cleared so far`,
        icon: AlertTriangle,
        tone: 'warning',
      },
      {
        label: 'Placement Opportunities',
        value: placements?.stats?.totalOpportunities || 0,
        note: `${placements?.stats?.applications || 0} applications submitted`,
        icon: Briefcase,
        tone: 'success',
      },
    ];
  }, [attendance, backlogs, placements, profile]);

  return (
    <>
      <Navbar
        title="Student Dashboard"
        subtitle="Academic progress, attendance, documents, and placements in one student workspace."
        onRefresh={loadDashboard}
        loading={loading}
      />

      <div className="dashboard-container flex-1">
        {banner ? (
          <div className="rounded-2xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
            {banner}
          </div>
        ) : null}

        <section id="overview" className="scroll-mt-28 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
          <div className="card flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="eyebrow">Student Command Center</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-content-primary">Welcome back, {profile?.name || user?.name || 'Student'}</h1>
                <p className="mt-2 max-w-2xl text-sm text-content-secondary">
                  Review your semester performance, keep documents ready for audits, and stay ahead on placements without leaving the student workspace.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-info">{profile?.department?.code || user?.department?.code || 'Dept pending'}</span>
                <span className={`badge ${profile?.isAtRisk ? 'badge-warning' : 'badge-success'}`}>{profile?.academicRecords?.performanceBand || 'On track'}</span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="section-muted p-4">
                <p className="metric-label">Roll Number</p>
                <p className="mt-2 text-lg font-semibold text-content-primary">{profile?.rollNumber || 'Not linked'}</p>
              </div>
              <div className="section-muted p-4">
                <p className="metric-label">Current Semester</p>
                <p className="mt-2 text-lg font-semibold text-content-primary">Semester {profile?.currentSemester || 1}</p>
              </div>
              <div className="section-muted p-4">
                <p className="metric-label">Risk Reasons</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile?.riskReasons?.length ? profile.riskReasons.map((reason) => <span key={reason} className="badge badge-warning">{reason}</span>) : <span className="badge badge-success">Healthy standing</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="section-header">
              <div>
                <p className="eyebrow">Profile</p>
                <h2 className="mt-1 text-xl font-semibold text-content-primary">Update contact details</h2>
                <p className="section-subtitle mt-1">Students can edit only personal contact information.</p>
              </div>
              <FileStack size={18} className="text-brand-300" />
            </div>

            <div className="mt-5 space-y-4">
              <input className="input-field" placeholder="Full name" value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} />
              <div className="grid gap-4 md:grid-cols-2">
                <input className="input-field" placeholder="Phone" value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} />
                <select className="input-field" value={profileForm.gender} onChange={(event) => setProfileForm((current) => ({ ...current, gender: event.target.value }))}>
                  <option value="">Select gender</option>
                  {['Male', 'Female', 'Other'].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <textarea className="textarea-field min-h-[7rem]" placeholder="Address" value={profileForm.address} onChange={(event) => setProfileForm((current) => ({ ...current, address: event.target.value }))} />
              <button type="button" className="btn-primary w-full" onClick={saveProfile} disabled={busyAction === 'profile'}>
                <Save size={16} /> {busyAction === 'profile' ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map(({ label, value, note, icon: Icon, tone }) => (
            <div key={label} className="metric-card">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone === 'warning' ? 'bg-warning/12 text-warning' : tone === 'success' ? 'bg-success/12 text-success' : tone === 'info' ? 'bg-info/12 text-info' : 'bg-brand-500/12 text-brand-200'}`}>
                <Icon size={20} />
              </div>
              <div>
                <p className="metric-label">{label}</p>
                <p className="metric-value mt-2">{loading ? '--' : value}</p>
                <p className="metric-note mt-2">{note}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div id="academic-progress" className="scroll-mt-28 xl:col-span-7">
            <SubjectsPerformance currentSemester={profile?.currentSemester} loading={loading} />
          </div>
          <div id="attendance-analytics" className="scroll-mt-28 xl:col-span-5">
            <AttendanceAnalytics data={attendance} loading={loading} />
          </div>
          <div id="backlog-tracker" className="scroll-mt-28 xl:col-span-4">
            <BacklogTracker data={backlogs} loading={loading} />
          </div>
          <div id="participation-records" className="scroll-mt-28 xl:col-span-8">
            <StudentAchievements
              data={achievements}
              loading={loading}
              submitting={busyAction === 'achievement'}
              onCreate={submitAchievement}
              assetOrigin={API_ORIGIN}
            />
          </div>
          <div id="feedback-system" className="scroll-mt-28 xl:col-span-6">
            <StudentFeedback
              data={feedback}
              loading={loading}
              submitting={busyAction === 'feedback'}
              onCreate={submitFeedback}
            />
          </div>
          <div id="document-upload" className="scroll-mt-28 xl:col-span-6">
            <StudentDocuments
              data={documents}
              loading={loading}
              submitting={busyAction === 'document'}
              onCreate={submitDocument}
              assetOrigin={API_ORIGIN}
            />
          </div>
          <div id="placement-portal" className="scroll-mt-28 xl:col-span-12">
            <PlacementPortal
              data={placements}
              loading={loading}
              submitting={busyAction === 'placement'}
              onApply={applyToPlacement}
              assetOrigin={API_ORIGIN}
            />
          </div>
        </section>
      </div>
    </>
  );
}





