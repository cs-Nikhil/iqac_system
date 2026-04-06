import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, PenSquare, Phone, Save, UserRound } from 'lucide-react';
import StudentActionButton from '../../components/student/StudentActionButton';
import StudentPageIntro from '../../components/student/StudentPageIntro';
import StudentReadOnlyNotice from '../../components/student/StudentReadOnlyNotice';
import { useStudentWorkspace } from './StudentWorkspaceLayout';
import { STUDENT_ROUTES } from './studentRoutes';

const initialForm = {
  name: '',
  phone: '',
  gender: '',
  address: '',
};

export default function EditProfile() {
  const {
    profile,
    loadingProfile,
    savingProfile,
    updateProfile,
    workspaceStatus,
    isReadOnly,
    readOnlyReason,
  } = useStudentWorkspace();
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setForm({
      name: profile.name || '',
      phone: profile.phone || '',
      gender: profile.gender || '',
      address: profile.address || '',
    });
  }, [profile]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isReadOnly) {
      setMessage({
        type: 'error',
        text: readOnlyReason,
      });
      return;
    }

    const result = await updateProfile(form);
    setMessage({
      type: result.success ? 'success' : 'error',
      text: result.success ? 'Profile updated successfully.' : result.message,
    });
  };

  return (
    <div className="space-y-6">
      <StudentPageIntro
        eyebrow="Profile"
        title="Edit Profile"
        description="Update your personal contact details in a dedicated flow while keeping the student overview focused on academic visibility."
        badges={[
          {
            value: workspaceStatus.badgeLabel,
            className: workspaceStatus.badgeClassName,
          },
          {
            value: profile?.department?.code || 'Department pending',
            className: 'badge-info',
          },
        ]}
        actions={(
          <Link to={STUDENT_ROUTES.overview} className="btn-secondary">
            <ArrowLeft size={16} />
            Back to overview
          </Link>
        )}
      />

      {message ? (
        <div className={`page-transition rounded-2xl border px-4 py-3 text-sm ${
          message.type === 'success'
            ? 'border-success/25 bg-success/10 text-success'
            : 'border-danger/25 bg-danger/10 text-danger'
        }`}>
          {message.text}
        </div>
      ) : null}

      {isReadOnly ? (
        <StudentReadOnlyNotice
          className="shadow-none"
          message={readOnlyReason}
          title="Profile editing is locked"
        />
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.78fr)]">
        <form className="student-shell page-transition p-6 sm:p-7" onSubmit={handleSubmit}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_24%)]" />

          <div className="relative space-y-5">
            <div className="section-header">
              <div>
                <p className="eyebrow">Editable Details</p>
                <h2 className="mt-1 text-2xl font-semibold text-content-primary">Contact information</h2>
                <p className="section-subtitle mt-2">
                  Keep these fields current for student services, placement communication, and department coordination.
                </p>
              </div>
            </div>

            <div className="grid gap-5">
              <label className="min-w-0">
                <span className="metric-label block">Full name</span>
                <input
                  className="input-field mt-2"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  disabled={isReadOnly || savingProfile}
                  title={isReadOnly ? readOnlyReason : undefined}
                  required
                />
              </label>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="min-w-0">
                  <span className="metric-label block">Phone</span>
                  <input
                    className="input-field mt-2"
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    disabled={isReadOnly || savingProfile}
                    title={isReadOnly ? readOnlyReason : undefined}
                  />
                </label>

                <label className="min-w-0">
                  <span className="metric-label block">Gender</span>
                  <select
                    className="input-field mt-2"
                    value={form.gender}
                    onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
                    disabled={isReadOnly || savingProfile}
                    title={isReadOnly ? readOnlyReason : undefined}
                  >
                    <option value="">Select gender</option>
                    {['Male', 'Female', 'Other'].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="min-w-0">
                <span className="metric-label block">Address</span>
                <textarea
                  className="textarea-field mt-2 min-h-[11rem]"
                  value={form.address}
                  onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                  disabled={isReadOnly || savingProfile}
                  title={isReadOnly ? readOnlyReason : undefined}
                  placeholder="Add your address"
                />
              </label>
            </div>

            <div className="student-shell-muted p-4 text-sm text-content-secondary">
              Only profile contact information is editable here. Academic records, semester details, attendance,
              and performance indicators remain managed by the IQAC system.
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Link to={STUDENT_ROUTES.overview} className="btn-secondary justify-center">
                Cancel
              </Link>

              <StudentActionButton
                type="submit"
                disabled={isReadOnly || savingProfile}
                tooltip={isReadOnly ? readOnlyReason : undefined}
                className="btn-primary justify-center"
              >
                <Save size={16} />
                {savingProfile ? 'Saving profile...' : 'Save profile'}
              </StudentActionButton>
            </div>
          </div>
        </form>

        <section className="space-y-6">
          <div className="student-shell page-transition p-6">
            <div className="section-header">
              <div>
                <p className="eyebrow">Read-only Context</p>
                <h2 className="mt-1 text-xl font-semibold text-content-primary">Academic identity</h2>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="student-shell-muted p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-brand-200">
                    <UserRound size={18} />
                  </div>
                  <div>
                    <p className="metric-label">Roll Number</p>
                    <p className="mt-2 text-base font-semibold text-content-primary">
                      {loadingProfile ? '--' : profile?.rollNumber || 'Not available'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="student-shell-muted p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-brand-200">
                    <Mail size={18} />
                  </div>
                  <div>
                    <p className="metric-label">Institution email</p>
                    <p className="mt-2 break-all text-base font-semibold text-content-primary">
                      {loadingProfile ? '--' : profile?.email || 'Not available'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="student-shell-muted p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-brand-200">
                    <Phone size={18} />
                  </div>
                  <div>
                    <p className="metric-label">Current semester</p>
                    <p className="mt-2 text-base font-semibold text-content-primary">
                      {loadingProfile ? '--' : `Semester ${profile?.currentSemester || 1}`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="student-shell page-transition p-6">
            <div className="section-header">
              <div>
                <p className="eyebrow">Editing Policy</p>
                <h2 className="mt-1 text-xl font-semibold text-content-primary">What changes here</h2>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm leading-6 text-content-secondary">
              <p className="student-shell-muted p-4">
                Name, phone, gender, and address can be maintained from this page while your account remains active.
              </p>
              <p className="student-shell-muted p-4">
                Once a student status becomes graduated, this page stays visible for reference but editing is disabled.
              </p>
              <p className="student-shell-muted p-4">
                Academic marks, attendance, backlogs, achievements, feedback history, documents, and placements continue
                to live in their own separate modules.
              </p>
            </div>

            <div className="mt-5">
              {isReadOnly ? (
                <StudentActionButton
                  type="button"
                  disabled
                  tooltip={readOnlyReason}
                  className="btn-secondary w-full justify-center"
                >
                  <PenSquare size={16} />
                  Editing locked
                </StudentActionButton>
              ) : (
                <div className="student-shell-muted p-4 text-sm text-content-secondary">
                  Save changes after updating your contact details. The student overview will reflect the updated profile immediately.
                </div>
              )}
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
