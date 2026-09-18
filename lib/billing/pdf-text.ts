export type PositionedText = {
  str: string;
  x: number;
  y: number;
  height?: number;
  hasEOL?: boolean;
};

function coord(transform: unknown, index: number): number {
  if (transform == null || typeof transform !== "object") {
    return 0;
  }
  const value = (transform as ArrayLike<unknown>)[index];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function toPositionedText(item: unknown): PositionedText | null {
  if (!item || typeof item !== "object" || !("str" in item)) {
    return null;
  }
  const str = (item as { str: unknown }).str;
  if (typeof str !== "string" || !str.trim()) {
    return null;
  }
  const transform = "transform" in item ? (item as { transform: unknown }).transform : undefined;
  const height = "height" in item ? (item as { height: unknown }).height : undefined;
  const hasEOL = "hasEOL" in item ? Boolean((item as { hasEOL: unknown }).hasEOL) : false;
  return {
    str,
    x: coord(transform, 4),
    y: coord(transform, 5),
    height: typeof height === "number" && Number.isFinite(height) ? height : undefined,
    hasEOL,
  };
}

function lineThreshold(item: PositionedText): number {
  const height = item.height && item.height > 0 ? item.height : 8;
  return Math.max(8, height * 0.85);
}

export function reconstructPdfLines(items: PositionedText[]): string {
  const usable = items.filter((item) => item.str.trim().length > 0);
  if (usable.length === 0) {
    return "";
  }

  const lines: PositionedText[][] = [];
  let current: PositionedText[] = [];
  let currentY: number | null = null;

  function flush() {
    if (current.length > 0) {
      lines.push(current);
    }
    current = [];
    currentY = null;
  }

  for (const item of usable) {
    const threshold = lineThreshold(item);
    if (currentY !== null && Math.abs(item.y - currentY) > threshold) {
      flush();
    }
    current.push(item);
    if (currentY === null) {
      currentY = item.y;
    }
    if (item.hasEOL) {
      flush();
    }
  }
  flush();

  const clustered = lines.length > 0 ? lines : clusterByY(usable);
  clustered.sort((a, b) => (b[0]?.y ?? 0) - (a[0]?.y ?? 0));
  return clustered
    .map((line) =>
      [...line]
        .sort((a, b) => a.x - b.x)
        .map((item) => item.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}

function clusterByY(items: PositionedText[]): PositionedText[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: PositionedText[][] = [];
  for (const item of sorted) {
    const threshold = lineThreshold(item);
    const line = lines.find((entry) => Math.abs((entry[0]?.y ?? 0) - item.y) <= threshold);
    if (line) {
      line.push(item);
    } else {
      lines.push([item]);
    }
  }
  return lines;
}

export function collapseSpacedLetterRuns(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const tokens = line.split(/\s+/).filter(Boolean);
      if (tokens.length === 0) {
        return "";
      }
      const out: string[] = [];
      let run: string[] = [];
      const flushRun = () => {
        if (run.length >= 3) {
          out.push(run.join(""));
        } else {
          out.push(...run);
        }
        run = [];
      };
      for (const token of tokens) {
        if (/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]$/.test(token)) {
          run.push(token);
        } else {
          flushRun();
          out.push(token);
        }
      }
      flushRun();
      return out.join(" ");
    })
    .join("\n");
}
