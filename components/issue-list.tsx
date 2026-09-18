import type { ValidationIssue } from "@/lib/domain/types";

function uniqueIssues(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  const unique: ValidationIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.code}:${issue.message}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(issue);
  }
  return unique;
}

export function IssueList({ issues }: { issues: ValidationIssue[] }) {
  const items = uniqueIssues(issues);
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className="notice-list">
      {items.map((issue, index) => (
        <li
          key={`${index}:${issue.code}`}
          className={
            issue.severity === "error" ? "notice notice-error" : "notice notice-warning"
          }
        >
          <span className="font-semibold">
            {issue.severity === "error" ? "Error: " : "Aviso: "}
          </span>
          {issue.message}
        </li>
      ))}
    </ul>
  );
}
