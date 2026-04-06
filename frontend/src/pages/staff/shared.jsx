import { BarChart3 } from 'lucide-react';

export function WorkspaceHeader({ title, subtitle, badge }) {
  return (
    <div className="section-header border-b border-line/80 px-5 py-4">
      <div>
        <h3 className="section-title">{title}</h3>
        <p className="section-subtitle mt-1">{subtitle}</p>
      </div>
      {badge ? <span className="badge badge-info">{badge}</span> : null}
    </div>
  );
}

export function ProgressStatCard({ title, value, caption, progress, tone = 'brand', trend }) {
  const toneStyles = {
    brand: 'bg-brand-500/15 text-brand-300',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    info: 'bg-info/15 text-info',
  };

  const progressStyles = {
    brand: 'bg-brand-500',
    success: 'bg-success',
    warning: 'bg-warning',
    info: 'bg-info',
  };

  return (
    <div className="card card-hover flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="metric-label">{title}</p>
          <p className="mt-3 metric-value">{value}</p>
          <p className="metric-note mt-1">{caption}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${toneStyles[tone] || toneStyles.brand}`}>
          <BarChart3 size={18} />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-2 overflow-hidden rounded-pill bg-panel-muted">
          <div className={`h-full rounded-pill ${progressStyles[tone] || progressStyles.brand}`} style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs text-content-muted">
          <span>{progress}% coverage</span>
          <span>{trend}</span>
        </div>
      </div>
    </div>
  );
}

export const formatDate = (value) => {
  if (!value) return 'Just now';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const downloadBlob = (data, fileName) => {
  const blob = data instanceof Blob ? data : new Blob([data]);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
