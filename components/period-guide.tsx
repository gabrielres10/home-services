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
    <nav className="period-guide-rail" aria-label="Guía de pasos del período">
      <div className="period-guide-now">
        <p className="kicker">Qué hacer ahora</p>
        <p className="period-guide-now-title">{nextTitle}</p>
        <p className="period-guide-now-detail">{nextDetail}</p>
      </div>
      <ol className="guide-steps">
        {steps.map((step) => (
          <li key={step.href} className={`guide-step is-${step.state}`}>
            <a href={step.href} aria-label={`Paso ${step.n}: ${step.title}. ${stateLabel[step.state]}`}>
              <span className="guide-n" aria-hidden>
                {step.n}
              </span>
              <span className="guide-copy">
                <strong>{step.title}</strong>
                <span className="guide-detail">{step.detail}</span>
              </span>
              <span className="guide-state">
                {step.state === "done" ? (
                  <span className="guide-check" aria-hidden>
                    <svg viewBox="0 0 16 16" width="12" height="12">
                      <path
                        fill="currentColor"
                        d="M6.35 11.15 2.9 7.7l1.15-1.15 2.3 2.3 5.6-5.65 1.15 1.15z"
                      />
                    </svg>
                  </span>
                ) : null}
                {stateLabel[step.state]}
              </span>
            </a>
          </li>
        ))}
      </ol>
      <a href={nextHref} className="btn btn-primary btn-full period-guide-cta">
        {nextLabel}
      </a>
    </nav>
  );
}
