export type ChartOverlayAnchor = {
  id: string;
  kind: 'entry' | 'sl' | 'tp';
  y: number;
  selected: boolean;
};

export type ChartOverlayLabel<T extends ChartOverlayAnchor> = {
  id: string;
  kind: ChartOverlayAnchor['kind'];
  selected: boolean;
  members: T[];
  /** Unmodified price coordinate. A connector can join this to labelY. */
  anchorY: number;
  labelY: number;
  offscreen: 'above' | 'below' | null;
};

export type ChartOverlayLayoutOptions = {
  top?: number;
  bottom?: number;
  gap?: number;
  groupDistance?: number;
};

const rank = { entry: 0, sl: 1, tp: 2 } as const;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const nonnegative = (value: number | undefined, fallback: number) =>
  value !== undefined && Number.isFinite(value) && value >= 0 ? value : fallback;

/**
 * Lay out price labels without changing the chart's price range.
 * Selected levels stay independent; nearby background entries share a label.
 * Overflow counts original levels, not the number of grouped labels.
 */
export function layoutChartOverlays<T extends ChartOverlayAnchor>(
  anchors: readonly T[],
  height: number,
  options: ChartOverlayLayoutOptions = {},
) {
  const availableHeight = Number.isFinite(height) ? Math.max(0, height) : 0;
  const top = nonnegative(options.top, 24);
  const bottom = nonnegative(options.bottom, 30);
  const gap = Math.max(1, nonnegative(options.gap, 32));
  const groupDistance = nonnegative(options.groupDistance, 14);
  const minY = Math.min(top, availableHeight);
  const maxY = Math.max(minY, availableHeight - bottom);
  const capacity = availableHeight >= top + bottom ? Math.floor((maxY - minY) / gap) + 1 : 0;
  const valid = anchors.filter(anchor => Number.isFinite(anchor.y));
  const candidates: ChartOverlayLabel<T>[] = [];
  const background = valid.filter(anchor => !anchor.selected && anchor.kind === 'entry')
    .sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));

  function add(members: T[]) {
    const anchorY = members.reduce((sum, anchor) => sum + anchor.y, 0) / members.length;
    candidates.push({
      id: members.length === 1 ? members[0].id : `group:${members.map(member => member.id).join('|')}`,
      kind: members[0].kind,
      selected: members.some(member => member.selected),
      members,
      anchorY,
      labelY: clamp(anchorY, minY, maxY),
      offscreen: anchorY < minY ? 'above' : anchorY > maxY ? 'below' : null,
    });
  }

  valid.filter(anchor => anchor.selected || anchor.kind !== 'entry').forEach(anchor => add([anchor]));
  let cluster: T[] = [];
  for (const anchor of background) {
    // Compare against the first price to avoid chaining a large range together.
    if (cluster.length && anchor.y - cluster[0].y > groupDistance) {
      add(cluster);
      cluster = [];
    }
    cluster.push(anchor);
  }
  if (cluster.length) add(cluster);

  const referenceY = valid.find(anchor => anchor.selected && anchor.kind === 'entry')?.y ?? (minY + maxY) / 2;
  candidates.sort((a, b) =>
    Number(b.selected) - Number(a.selected)
    || (a.selected && b.selected ? rank[a.kind] - rank[b.kind] : 0)
    || Math.abs(a.anchorY - referenceY) - Math.abs(b.anchorY - referenceY)
    || a.id.localeCompare(b.id),
  );
  const overflowAnchors = candidates.slice(capacity).flatMap(label => label.members);
  const labels = candidates.slice(0, capacity).sort((a, b) =>
    a.anchorY - b.anchorY || rank[a.kind] - rank[b.kind] || a.id.localeCompare(b.id),
  );

  // Isotonic projection spaces colliding labels around their prices instead of
  // pushing every collision down. This retains price order and a fixed gap.
  const blocks: { start: number; end: number; sum: number; count: number }[] = [];
  labels.forEach((label, index) => {
    blocks.push({ start: index, end: index, sum: label.labelY - index * gap, count: 1 });
    while (blocks.length > 1) {
      const right = blocks[blocks.length - 1], left = blocks[blocks.length - 2];
      if (left.sum / left.count <= right.sum / right.count) break;
      blocks.splice(blocks.length - 2, 2, {
        start: left.start, end: right.end,
        sum: left.sum + right.sum, count: left.count + right.count,
      });
    }
  });
  const upper = maxY - Math.max(0, labels.length - 1) * gap;
  blocks.forEach(block => {
    const base = clamp(block.sum / block.count, minY, upper);
    for (let index = block.start; index <= block.end; index++) labels[index].labelY = base + index * gap;
  });

  return { labels, overflowCount: overflowAnchors.length, overflowAnchors, capacity, minY, maxY };
}
