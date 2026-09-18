import type { ValidationIssue } from "@/lib/domain/types";

export function IssueList({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-1">
      {issues.map((issue) => (
        <li
          key={issue.code + issue.message}
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
