export type GuideStepState = "done" | "current" | "wait" | "optional";

export type GuideStep = {
  href: string;
  n: number;
  title: string;
  detail: string;
  state: GuideStepState;
};

const stateLabel: Record<GuideStepState, string> = {
  done: "Hecho",
  current: "Ahora",
  wait: "Después",
  optional: "Opcional",
};

export function PeriodGuide({
  nextTitle,
  nextDetail,
  nextHref,
  nextLabel,
  steps,
}: {
  nextTitle: string;
  nextDetail: string;
  nextHref: string;
  nextLabel: string;
  steps: GuideStep[];
}) {
  return (
    <div className="guide-layout">
      <aside className="now-card">
        <p className="kicker">Qué hacer ahora</p>
        <h2>{nextTitle}</h2>
        <p>{nextDetail}</p>
        <a href={nextHref} className="btn btn-primary">
          {nextLabel}
        </a>
      </aside>
      <ol className="guide-steps">
        {steps.map((step) => (
          <li key={step.href} className={`guide-step is-${step.state}`}>
            <a href={step.href}>
              <span className="guide-n">{step.n}</span>
              <span>
                <strong>{step.title}</strong>
                <span className="guide-detail">{step.detail}</span>
              </span>
              <span className="guide-state">{stateLabel[step.state]}</span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function JumpNav({
  items,
}: {
  items: Array<{ href: string; label: string }>;
}) {
  return (
    <nav aria-label="Partes de esta página">
      <p className="kicker section-kicker">Ir a una parte</p>
      <ul className="jump-nav">
        {items.map((item) => (
          <li key={item.href}>
            <a href={item.href}>{item.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
