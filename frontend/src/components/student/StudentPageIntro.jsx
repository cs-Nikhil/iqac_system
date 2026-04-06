export default function StudentPageIntro({
  eyebrow,
  title,
  description,
  badges = [],
  actions = null,
}) {
  return (
    <section className="page-transition student-shell student-hero p-6 sm:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(59,130,246,0.24),transparent_28%),radial-gradient(circle_at_82%_12%,rgba(168,85,247,0.18),transparent_22%),radial-gradient(circle_at_88%_78%,rgba(14,165,233,0.12),transparent_20%)]" />

      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-content-primary sm:text-[2.4rem]">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-content-secondary sm:text-[15px]">{description}</p>
        </div>

        <div className="flex flex-col gap-3 xl:items-end">
          {actions ? <div className="flex flex-wrap gap-3 xl:justify-end [&>*]:shadow-[0_22px_44px_-28px_rgba(15,23,42,0.95)]">{actions}</div> : null}

          {badges.length ? (
            <div className="flex flex-wrap gap-2 xl:justify-end">
              {badges.map((badge) => (
                <span key={`${badge.label}-${badge.value}`} className={`badge student-glow-badge ${badge.className || 'badge-info'}`}>
                  {badge.label ? `${badge.label} ` : ''}
                  {badge.value}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
