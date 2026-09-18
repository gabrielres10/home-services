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
    <ul className="space-y-1">
      {items.map((issue, index) => (
        <li
          key={`${index}:${issue.code}`}
          className={
            issue.severity === "error"
              ? "rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
              : "rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          }
        >
          <span className="font-medium">
            {issue.severity === "error" ? "Error: " : "Aviso: "}
          </span>
          {issue.message}
        </li>
      ))}
    </ul>
  );
}
