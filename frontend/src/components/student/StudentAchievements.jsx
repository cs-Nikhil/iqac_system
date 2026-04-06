import { useState } from 'react';
import { Award, CalendarRange } from 'lucide-react';

const initialForm = {
  title: '',
  description: '',
  category: 'Competition',
  level: 'Local',
  date: '',
};

const getAssetUrl = (assetOrigin, filePath) => {
  if (!filePath) {
    return '';
  }

  if (/^https?:\/\//i.test(filePath)) {
    return filePath;
  }

  return `${assetOrigin}${filePath}`;
};

export default function StudentAchievements({ data, loading, submitting, onCreate, assetOrigin }) {
  const [form, setForm] = useState(initialForm);
  const [certificate, setCertificate] = useState(null);
  const achievements = data?.achievements || [];
  const participations = data?.participations || [];

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => payload.append(key, value));
    if (certificate) {
      payload.append('certificate', certificate);
    }

    const result = await onCreate(payload);
    if (result?.success !== false) {
      setForm(initialForm);
      setCertificate(null);
    }
  };

  return (
    <section className="card flex h-full flex-col gap-5 p-6">
      <div className="section-header">
        <div>
          <p className="eyebrow">Participation Records</p>
          <h3 className="mt-1 text-xl font-semibold text-content-primary">Upload achievements and showcase participation</h3>
          <p className="section-subtitle mt-1">Track certificates, awards, workshops, and event participation from a single workspace.</p>
        </div>
        <div className="badge badge-info">{achievements.length} achievements</div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(18rem,0.95fr)_minmax(0,1.05fr)]">
        <form className="surface-inset space-y-4 p-4" onSubmit={handleSubmit}>
          <div>
            <p className="metric-label">Add Participation / Achievement</p>
            <p className="metric-note mt-1">Upload supporting proof for competitions, certifications, and workshops.</p>
          </div>
          <input className="input-field" placeholder="Achievement title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
          <textarea className="textarea-field min-h-[7rem]" placeholder="Description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} required />
          <div className="grid gap-4 md:grid-cols-2">
            <select className="input-field" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
              {['Competition', 'Award', 'Certification', 'Publication', 'Research', 'Sports', 'Cultural', 'Other'].map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select className="input-field" value={form.level} onChange={(event) => setForm((current) => ({ ...current, level: event.target.value }))}>
              {['Local', 'State', 'National', 'International'].map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <input className="input-field" type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
          <input className="file-field" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(event) => setCertificate(event.target.files?.[0] || null)} />
          <button type="submit" className="btn-primary w-full" disabled={submitting}>{submitting ? 'Uploading...' : 'Upload record'}</button>
        </form>

        <div className="space-y-4">
          <div className="surface-inset p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="metric-label">Achievement Timeline</p>
                <p className="metric-note mt-1">Latest uploads and verified records.</p>
              </div>
              <Award size={16} className="text-brand-300" />
            </div>
            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="space-y-3">
                  <div className="skeleton-line w-full" />
                  <div className="skeleton-line w-4/5" />
                  <div className="skeleton-line w-3/5" />
                </div>
              ) : achievements.length === 0 ? (
                <div className="empty-state min-h-[10rem]">Upload your first achievement or certificate to start the record.</div>
              ) : achievements.slice(0, 4).map((achievement) => (
                <article key={achievement._id} className="rounded-xl border border-line/60 bg-panel-subtle/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-content-primary">{achievement.title}</p>
                      <p className="mt-1 text-xs text-content-secondary">{achievement.description}</p>
                    </div>
                    <span className={`badge ${achievement.verified ? 'badge-success' : 'badge-info'}`}>{achievement.level}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-content-muted">
                    <span>{achievement.category}</span>
                    <span>•</span>
                    <span>{new Date(achievement.date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
                    {achievement.documents?.[0] ? (
                      <>
                        <span>•</span>
                        <a className="text-brand-300 hover:text-brand-200" href={getAssetUrl(assetOrigin, achievement.documents[0])} target="_blank" rel="noreferrer">View proof</a>
                      </>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="surface-inset p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="metric-label">Event Participation</p>
                <p className="metric-note mt-1">Participation records imported from the event module.</p>
              </div>
              <CalendarRange size={16} className="text-info" />
            </div>
            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="space-y-3">
                  <div className="skeleton-line w-full" />
                  <div className="skeleton-line w-4/5" />
                </div>
              ) : participations.length === 0 ? (
                <div className="empty-state min-h-[9rem]">No event participation records available yet.</div>
              ) : participations.slice(0, 4).map((entry) => (
                <div key={entry._id} className="rounded-xl border border-line/60 bg-panel-subtle/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-content-primary">{entry.event?.title}</p>
                      <p className="text-xs text-content-muted">{entry.event?.type} · {entry.event?.level}</p>
                    </div>
                    <span className="badge badge-info">{entry.role}</span>
                  </div>
                  <p className="mt-2 text-xs text-content-secondary">{entry.achievement || 'Participation recorded successfully.'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

