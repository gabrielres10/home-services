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
  variant?: "wide" | "narrow" | "form";
}) {
  const width =
    variant === "narrow" ? "page-main-narrow" : variant === "form" ? "page-main-form" : "";
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
