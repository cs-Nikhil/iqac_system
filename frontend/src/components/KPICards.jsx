import { TrendingDown, TrendingUp } from 'lucide-react';

const formatValue = (value, type) => {
  if (type === 'percentage') return `${value}%`;
  if (type === 'currency') return `Rs.${value}`;
  if (typeof value === 'number' && value >= 1000) return value.toLocaleString('en-IN');
  return value;
};

const TONE_STYLES = {
  brand: {
    shell: 'bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/20',
    text: 'text-brand-300',
  },
  success: {
    shell: 'bg-success/15 text-success ring-1 ring-success/20',
    text: 'text-success',
  },
  warning: {
    shell: 'bg-warning/15 text-warning ring-1 ring-warning/20',
    text: 'text-warning',
  },
  violet: {
    shell: 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/20',
    text: 'text-violet-300',
  },
  cyan: {
    shell: 'bg-info/15 text-info ring-1 ring-info/20',
    text: 'text-info',
  },
  pink: {
    shell: 'bg-pink-500/15 text-pink-300 ring-1 ring-pink-400/20',
    text: 'text-pink-300',
  },
};

export default function KPICards({ cards }) {
  return (
    <div className="metric-grid">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const tone = TONE_STYLES[card.tone] || TONE_STYLES.brand;

        return (
          <div key={index} className="metric-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="metric-label">{card.label}</p>
                <div className="mt-3">
                  {card.loading ? (
                    <div className="skeleton h-8 w-20" />
                  ) : (
                    <p className="metric-value">{formatValue(card.value, card.type)}</p>
                  )}
                  {card.sub ? <p className="metric-note mt-1">{card.sub}</p> : null}
                </div>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone.shell}`}>
                <Icon size={18} />
              </div>
            </div>

            {card.trend !== undefined ? (
              <div className={`inline-flex w-fit items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-semibold ${card.trend >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                {card.trend >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                <span>{Math.abs(card.trend)}% from last year</span>
              </div>
            ) : (
              <div className="h-6" />
            )}
          </div>
        );
      })}
    </div>
  );
}
