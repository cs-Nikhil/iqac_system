import { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, FileBadge2, Medal, UploadCloud } from 'lucide-react';
import StudentActionButton from '../../components/student/StudentActionButton';
import StudentPageIntro from '../../components/student/StudentPageIntro';
import { API_ORIGIN, studentPortalAPI } from '../../services/api';
import { useStudentWorkspace } from './StudentWorkspaceLayout';

const initialForm = {
  title: '',
  description: '',
  category: 'Competition',
  level: 'Local',
  date: '',
};

const getAssetUrl = (filePath) => {
  if (!filePath) {
    return '';
  }

  if (/^https?:\/\//i.test(filePath)) {
    return filePath;
  }

  return `${API_ORIGIN}${filePath}`;
};

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium' })
    : 'Date pending';

function SummaryCard({ label, value, note, icon: Icon, tone = 'brand', progress = 0 }) {
  const toneClass =
    tone === 'success'
      ? 'student-stat-icon student-stat-icon--success'
      : tone === 'warning'
        ? 'student-stat-icon student-stat-icon--warning'
        : tone === 'info'
          ? 'student-stat-icon student-stat-icon--info'
          : 'student-stat-icon student-stat-icon--brand';

  const progressTone =
    tone === 'success'
      ? 'student-progress-fill student-progress-fill--success'
      : tone === 'warning'
        ? 'student-progress-fill student-progress-fill--warning'
        : 'student-progress-fill student-progress-fill--brand';

  return (
    <div className="student-stat-card page-transition">
      <div className="student-stat-content space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className={toneClass}>
            <Icon size={19} />
          </div>
          <span className="badge student-glow-badge badge-info">{label}</span>
        </div>

        <div>
          <p className="metric-label">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-content-primary">{value}</p>
          <p className="mt-2 text-sm text-content-secondary">{note}</p>
        </div>

        <div className="student-progress-track">
          <div className={progressTone} style={{ width: `${Math.max(12, Math.min(100, Number(progress || 0)))}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function Achievements() {
  const { workspaceStatus, isReadOnly, readOnlyReason } = useStudentWorkspace();
  const [records, setRecords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [certificate, setCertificate] = useState(null);
  const [message, setMessage] = useState('');

  const loadAchievements = useCallback(async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await studentPortalAPI.getAchievements();
      setRecords(response.data?.data || null);
    } catch (error) {
      setRecords(null);
      setMessage(error.response?.data?.message || 'Unable to load student achievements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAchievements();
  }, [loadAchievements]);

  const achievements = records?.achievements || [];
  const verifiedCount = useMemo(
    () => achievements.filter((achievement) => achievement.verified).length,
    [achievements]
  );
  const nationalAndAbove = useMemo(
    () =>
      achievements.filter((achievement) =>
        ['National', 'International'].includes(achievement.level)
      ).length,
    [achievements]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isReadOnly) {
      setMessage(readOnlyReason);
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value));
      if (certificate) {
        payload.append('certificate', certificate);
      }

      await studentPortalAPI.createAchievement(payload);
      setForm(initialForm);
      setCertificate(null);
      await loadAchievements();
      setMessage('Achievement uploaded successfully.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to upload this achievement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <StudentPageIntro
        eyebrow="Activities"
        title="Achievements"
        description="Manage student certificates, recognitions, and achievement evidence in a dedicated module separate from participation records."
        badges={[
          {
            value: `${achievements.length} achievements`,
            className: 'badge-info',
          },
          {
            value: workspaceStatus.badgeLabel,
            className: workspaceStatus.badgeClassName,
          },
        ]}
      />

      {message ? (
        <div className={`page-transition rounded-2xl border px-4 py-3 text-sm ${
          message.includes('successfully')
            ? 'border-success/25 bg-success/10 text-success'
            : 'border-danger/25 bg-danger/10 text-danger'
        }`}>
          {message}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Achievements"
          value={loading ? '--' : achievements.length}
          note="All uploaded recognitions and proof"
          icon={Award}
          tone="brand"
          progress={Math.min(100, Math.max(12, achievements.length * 14))}
        />
        <SummaryCard
          label="Verified Records"
          value={loading ? '--' : verifiedCount}
          note="Records already marked as verified"
          icon={FileBadge2}
          tone="success"
          progress={achievements.length ? (verifiedCount / achievements.length) * 100 : 12}
        />
        <SummaryCard
          label="National+"
          value={loading ? '--' : nationalAndAbove}
          note="National and international level achievements"
          icon={Medal}
          tone="warning"
          progress={achievements.length ? (nationalAndAbove / achievements.length) * 100 : 12}
        />
        <SummaryCard
          label="Latest Uploads"
          value={loading ? '--' : Math.min(achievements.length, 4)}
          note="Most recent entries shown below"
          icon={UploadCloud}
          tone="info"
          progress={Math.min(100, Math.max(12, Math.min(achievements.length, 4) * 25))}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(19rem,0.9fr)_minmax(0,1.1fr)]">
        <form className="student-shell page-transition p-6" onSubmit={handleSubmit}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_24%)]" />

          <div className="relative space-y-4">
            <div>
              <p className="eyebrow">Achievement Upload</p>
              <h2 className="mt-1 text-xl font-semibold text-content-primary">Add a new record</h2>
              <p className="section-subtitle mt-1">
                Keep achievement evidence organized for student profiling and IQAC review.
              </p>
            </div>

            {isReadOnly ? (
              <div className="rounded-2xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
                Achievement uploads are disabled for graduated students. Existing records remain available below.
              </div>
            ) : null}

            <input
              className="input-field"
              placeholder="Achievement title"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              disabled={isReadOnly || submitting}
              title={isReadOnly ? readOnlyReason : undefined}
              required
            />
            <textarea
              className="textarea-field min-h-[7rem]"
              placeholder="Description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              disabled={isReadOnly || submitting}
              title={isReadOnly ? readOnlyReason : undefined}
              required
            />

            <div className="grid gap-4 md:grid-cols-2">
              <select
                className="input-field"
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                disabled={isReadOnly || submitting}
                title={isReadOnly ? readOnlyReason : undefined}
              >
                {['Competition', 'Award', 'Certification', 'Publication', 'Research', 'Sports', 'Cultural', 'Other'].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                className="input-field"
                value={form.level}
                onChange={(event) => setForm((current) => ({ ...current, level: event.target.value }))}
                disabled={isReadOnly || submitting}
                title={isReadOnly ? readOnlyReason : undefined}
              >
                {['Local', 'State', 'National', 'International'].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <input
              className="input-field"
              type="date"
              value={form.date}
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              disabled={isReadOnly || submitting}
              title={isReadOnly ? readOnlyReason : undefined}
            />
            <input
              className="file-field"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={(event) => setCertificate(event.target.files?.[0] || null)}
              disabled={isReadOnly || submitting}
              title={isReadOnly ? readOnlyReason : undefined}
            />

            <StudentActionButton
              type="submit"
              disabled={isReadOnly || submitting}
              tooltip={isReadOnly ? readOnlyReason : undefined}
              className="btn-primary w-full justify-center"
            >
              {submitting ? 'Uploading achievement...' : 'Upload achievement'}
            </StudentActionButton>
          </div>
        </form>

        <section className="student-shell page-transition p-6">
          <div className="section-header">
            <div>
              <p className="eyebrow">Achievement Timeline</p>
              <h2 className="mt-1 text-xl font-semibold text-content-primary">Recent student recognitions</h2>
              <p className="section-subtitle mt-1">
                Achievements stay isolated here so participation and awards are easy to review separately.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {loading ? (
              <div className="space-y-3">
                <div className="skeleton-line w-full" />
                <div className="skeleton-line w-4/5" />
                <div className="skeleton-line w-3/5" />
              </div>
            ) : achievements.length === 0 ? (
              <div className="empty-state min-h-[12rem]">No achievements uploaded yet.</div>
            ) : (
              achievements.map((achievement) => (
                <article key={achievement._id} className="student-list-card">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-content-primary">{achievement.title}</p>
                        <span className="badge badge-info">{achievement.category}</span>
                      </div>
                      <p className="mt-2 text-sm text-content-secondary">{achievement.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`badge ${achievement.verified ? 'badge-success' : 'badge-warning'}`}>
                        {achievement.level}
                      </span>
                      {achievement.documents?.[0] ? (
                        <a
                          className="badge badge-info hover:border-brand-300/30"
                          href={getAssetUrl(achievement.documents[0])}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View proof
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-content-muted">{formatDate(achievement.date)}</div>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
