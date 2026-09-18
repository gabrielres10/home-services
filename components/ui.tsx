export function HouseMark({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span className={size === "lg" ? "house-mark house-mark-lg" : "house-mark"} aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}

export function PageMain({
  children,
  variant = "wide",
}: {
  children: React.ReactNode;
  variant?: "wide" | "narrow" | "form" | "guided";
}) {
  const width =
    variant === "narrow"
      ? "page-main-narrow"
      : variant === "form"
        ? "page-main-form"
        : variant === "guided"
          ? "page-main-guided"
          : "";
  return <main className={`page-main ${width}`.trim()}>{children}</main>;
}

export function SectionHeading({
  kicker,
  children,
  action,
}: {
  kicker?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        {kicker ? <p className="kicker section-kicker">{kicker}</p> : null}
        <h2 className="section-title">{children}</h2>
      </div>
      {action}
    </div>
  );
}

export function WorkPanel({
  id,
  step,
  kicker,
  title,
  hint,
  children,
}: {
  id?: string;
  step?: number;
  kicker?: string;
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="work-panel">
      <header className="work-panel-head">
        {step != null ? (
          <span className="step-index" aria-hidden>
            {String(step).padStart(2, "0")}
          </span>
        ) : null}
        <div>
          {kicker ? <p className="kicker">{kicker}</p> : null}
          <h2 className="section-title">{title}</h2>
          {hint ? <p className="work-panel-hint">{hint}</p> : null}
        </div>
      </header>
      <div className="work-panel-body">{children}</div>
    </section>
  );
}

export function FloorBand({
  id,
  tone,
  name,
  occupant,
  status,
  children,
}: {
  id?: string;
  tone: 1 | 2 | 3;
  name: string;
  occupant?: string | null;
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`floor-band floor-band-${tone}`}>
      <header className="floor-band-head">
        <p className="kicker">Empieza {name}</p>
        <h3 className="floor-band-title">
          {name}
          {occupant ? <span className="floor-band-occupant">{occupant}</span> : null}
        </h3>
        {status}
      </header>
      {children}
      <p className="floor-band-end">Fin de {name}</p>
    </section>
  );
}
