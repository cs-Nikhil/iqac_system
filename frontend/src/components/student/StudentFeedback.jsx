import { useMemo, useState } from 'react';
import { MessageSquareText, Sparkles, Star, Users2 } from 'lucide-react';
import StudentActionButton from './StudentActionButton';

const initialForm = {
  faculty: '',
  courseName: '',
  teachingQuality: 4,
  courseDifficulty: 3,
  infrastructureQuality: 4,
  comments: '',
};

const ratingOptions = [1, 2, 3, 4, 5];

function FeedbackMetric({ label, value, note, icon: Icon, tone = 'brand', progress = 0 }) {
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
    <div className="student-stat-card">
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

export default function StudentFeedback({
  data,
  loading,
  submitting,
  onCreate,
  readOnly = false,
  readOnlyReason = '',
}) {
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');
  const feedback = data?.feedback || [];
  const facultyOptions = data?.facultyOptions || [];

  const feedbackMetrics = useMemo(() => {
    const averageRating = feedback.length
      ? feedback.reduce((total, entry) => total + Number(entry.overallRating || 0), 0) / feedback.length
      : 0;
    const facultyCovered = new Set(feedback.map((entry) => entry.faculty?._id).filter(Boolean)).size;

    return [
      {
        label: 'Responses',
        value: loading ? '--' : feedback.length,
        note: 'Feedback submissions recorded in this module',
        icon: MessageSquareText,
        tone: 'brand',
        progress: Math.min(100, Math.max(12, feedback.length * 18)),
      },
      {
        label: 'Avg Rating',
        value: loading ? '--' : averageRating.toFixed(1),
        note: 'Average overall sentiment across responses',
        icon: Star,
        tone: 'success',
        progress: averageRating * 20,
      },
      {
        label: 'Faculty Covered',
        value: loading ? '--' : facultyCovered,
        note: 'Distinct faculty members mentioned so far',
        icon: Users2,
        tone: 'info',
        progress: Math.min(100, Math.max(12, facultyCovered * 20)),
      },
    ];
  }, [feedback, loading]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    const result = await onCreate({
      faculty: form.faculty || undefined,
      courseName: form.courseName,
      ratings: {
        teachingQuality: Number(form.teachingQuality),
        courseDifficulty: Number(form.courseDifficulty),
        infrastructureQuality: Number(form.infrastructureQuality),
      },
      comments: form.comments,
    });

    if (result?.success === false) {
      setMessage(result.message || 'Unable to submit student feedback.');
      return;
    }

    setMessage('Feedback submitted successfully.');
    if (result?.success !== false) {
      setForm(initialForm);
    }
  };

  return (
    <section className="student-shell flex h-full flex-col gap-6 p-6 sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.12),transparent_22%)]" />

      <div className="relative flex flex-col gap-6">
        <div className="section-header">
          <div>
            <p className="eyebrow">Feedback System</p>
            <h3 className="mt-1 text-2xl font-semibold text-content-primary">Share course and teaching feedback</h3>
            <p className="section-subtitle mt-2 max-w-2xl">
              Submit structured feedback on faculty, course delivery, and infrastructure with a cleaner review flow.
            </p>
          </div>
          <div className={`badge student-glow-badge ${readOnly ? 'badge-warning' : 'badge-info'}`}>
            {readOnly ? 'View-only access' : `${feedback.length} responses`}
          </div>
        </div>

        {message ? (
          <div className={`rounded-[24px] border px-4 py-3 text-sm shadow-[0_18px_48px_-32px_rgba(15,23,42,0.95)] backdrop-blur-md ${
            message.includes('successfully')
              ? 'border-success/25 bg-success/10 text-success'
              : 'border-danger/25 bg-danger/10 text-danger'
          }`}>
            {message}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {feedbackMetrics.map((card) => (
            <FeedbackMetric key={card.label} {...card} />
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(19rem,0.95fr)_minmax(0,1.05fr)]">
          <form className="student-shell-muted space-y-4 p-5 sm:p-6" onSubmit={handleSubmit}>
            <div>
              <p className="metric-label">Submit Feedback</p>
              <h4 className="mt-2 text-xl font-semibold text-content-primary">Share a structured course review</h4>
              <p className="mt-2 text-sm text-content-secondary">
                Your responses help improve teaching quality, student experience, and infrastructure planning.
              </p>
            </div>

            {readOnly ? (
              <div className="rounded-[24px] border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
                Feedback submission is disabled because this student profile is graduated.
              </div>
            ) : null}

            <select
              className="input-field"
              value={form.faculty}
              onChange={(event) => setForm((current) => ({ ...current, faculty: event.target.value }))}
              disabled={readOnly || submitting}
              title={readOnly ? readOnlyReason : undefined}
            >
              <option value="">Select faculty</option>
              {facultyOptions.map((faculty) => (
                <option key={faculty._id} value={faculty._id}>
                  {`${faculty.name} / ${faculty.designation}`}
                </option>
              ))}
            </select>

            <input
              className="input-field"
              placeholder="Course name"
              value={form.courseName}
              onChange={(event) => setForm((current) => ({ ...current, courseName: event.target.value }))}
              disabled={readOnly || submitting}
              title={readOnly ? readOnlyReason : undefined}
              required
            />

            <div className="grid gap-4 md:grid-cols-3">
              {[
                ['teachingQuality', 'Teaching'],
                ['courseDifficulty', 'Difficulty'],
                ['infrastructureQuality', 'Infrastructure'],
              ].map(([key, label]) => (
                <label key={key} className="min-w-0">
                  <span className="metric-label block">{label}</span>
                  <select
                    className="input-field mt-2"
                    value={form[key]}
                    onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                    disabled={readOnly || submitting}
                    title={readOnly ? readOnlyReason : undefined}
                  >
                    {ratingOptions.map((option) => (
                      <option key={option} value={option}>
                        {option} / 5
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <textarea
              className="textarea-field min-h-[7rem]"
              placeholder="Comments"
              value={form.comments}
              onChange={(event) => setForm((current) => ({ ...current, comments: event.target.value }))}
              disabled={readOnly || submitting}
              title={readOnly ? readOnlyReason : undefined}
              required
            />

            <StudentActionButton
              type="submit"
              disabled={readOnly || submitting}
              tooltip={readOnly ? readOnlyReason : undefined}
              className="btn-primary w-full justify-center"
            >
              {submitting ? 'Submitting...' : 'Submit feedback'}
            </StudentActionButton>
          </form>

          <section className="student-shell-muted p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="metric-label">Recent Feedback</p>
                <p className="mt-2 text-sm text-content-secondary">
                  Your previous responses remain visible for review, even if the profile becomes read-only later.
                </p>
              </div>
              <div className="student-stat-icon student-stat-icon--info h-10 w-10">
                <Sparkles size={16} />
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {loading ? (
                <div className="space-y-4">
                  <div className="skeleton h-32 rounded-[24px]" />
                  <div className="skeleton h-32 rounded-[24px]" />
                </div>
              ) : feedback.length === 0 ? (
                <div className="empty-state min-h-[12rem]">No feedback submissions yet. Your next course review can start here.</div>
              ) : (
                feedback.slice(0, 5).map((entry) => (
                  <article key={entry._id} className="student-list-card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-content-primary">{entry.courseName}</p>
                        <p className="mt-1 text-sm text-content-secondary">{entry.faculty?.name || 'Faculty not specified'}</p>
                      </div>
                      <div className="badge student-glow-badge badge-success">
                        <Star size={12} /> {Number(entry.overallRating || 0).toFixed(1)}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {[
                        ['Teaching', entry.ratings?.teachingQuality],
                        ['Difficulty', entry.ratings?.courseDifficulty],
                        ['Infra', entry.ratings?.infrastructureQuality],
                      ].map(([label, value]) => (
                        <div key={label} className="student-shell-muted p-3">
                          <p className="metric-label">{label}</p>
                          <p className="mt-2 text-base font-semibold text-content-primary">{value}/5</p>
                        </div>
                      ))}
                    </div>

                    <p className="mt-4 text-sm leading-6 text-content-secondary">{entry.comments}</p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
