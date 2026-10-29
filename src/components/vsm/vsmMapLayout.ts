// VSM map geometry (plan step V3): every coordinate of the drawn map comes from here, so the canvas grows
// with the number of processes instead of being a fixed 2200 px stage. Layout (left → right):
//
//   [Tedarikçi]           [Üretim Planlama]            [Müşteri]
//        │ truck                  │ schedule bus            ▲ truck
//   (raw ▲) ─▶ (stock) [P1] ─▶ (stock) [P2] … [Pn] ─▶ (FG ▲) ─┘
//   timeline ladder: wait over each stock zone, value-added time under each process
//
// The stock zone in front of a process shows that process's `inventoryBefore`. Pure functions.

export const MAP = {
  boxTop: 20,
  supplierX: 20,
  boxW: 260,
  planningW: 280,
  infoY: 75,             // horizontal information-flow line
  scheduleBusY: 262,     // horizontal schedule line above the process cards
  cardTop: 300,
  cardW: 220,
  cardH: 262,            // approximate drawn height (linear mode, with the C/O row)
  stockW: 80,            // stock zone in front of each process
  rawZoneX: 40,          // raw material triangle zone
  startX: 240,           // first process card
  laneGap: 40,
  minWidth: 1300,
  rightMargin: 20
} as const;

export const PITCH = MAP.cardW + MAP.stockW;
export const LINE_DY = 110;                       // material-flow line, relative to card top
export const GRAPH_LANE_HEIGHT = MAP.cardH + MAP.laneGap;

export interface VsmMapLayout {
  width: number;
  height: number;
  lineY: number;                 // material-flow line (linear mode)
  cardX: (i: number) => number;  // linear mode card left
  stockZoneX: (i: number) => number;  // left of the stock zone in front of card i
  lastRight: number;             // right edge of the right-most card
  fgZoneX: number;
  planning: { x: number; w: number };
  customer: { x: number; w: number };
  timelineTop: number;
}

// `columns` = number of process columns (n for a linear chain, maxRank + 1 for a graph);
// `lanes` = rows of process cards (1 for a linear chain).
export function computeMapLayout(columns: number, lanes: number, laneSummaryRows = 0): VsmMapLayout {
  const cols = Math.max(1, columns);
  const cardX = (i: number) => MAP.startX + i * PITCH;
  const lastRight = cardX(cols - 1) + MAP.cardW;
  const fgZoneX = lastRight + 20;
  const customerX = Math.max(fgZoneX + MAP.stockW + 40, MAP.minWidth - MAP.boxW - MAP.rightMargin);
  const width = customerX + MAP.boxW + MAP.rightMargin;
  // Production control sits midway between the supplier and customer boxes.
  const gapLeft = MAP.supplierX + MAP.boxW;
  const planningX = Math.round((gapLeft + customerX) / 2 - MAP.planningW / 2);
  const rows = Math.max(1, lanes);
  const cardsBottom = MAP.cardTop + rows * MAP.cardH + (rows - 1) * MAP.laneGap;
  const timelineTop = cardsBottom + 36;
  const height = lanes > 1
    ? timelineTop + 60 + laneSummaryRows * 40
    : timelineTop + 130;
  return {
    width,
    height,
    lineY: MAP.cardTop + LINE_DY,
    cardX,
    stockZoneX: (i: number) => cardX(i) - MAP.stockW,
    lastRight,
    fgZoneX,
    planning: { x: planningX, w: MAP.planningW },
    customer: { x: customerX, w: MAP.boxW },
    timelineTop
  };
}

// Horizontal information arrow with the standard "electronic" zig-zag in the middle (manual = straight).
export function infoPath(x1: number, x2: number, y: number, electronic: boolean): string {
  if (!electronic || Math.abs(x2 - x1) < 60) return `M ${x1},${y} L ${x2},${y}`;
  const m = (x1 + x2) / 2;
  const dir = x2 > x1 ? 1 : -1;
  return `M ${x1},${y} L ${m - 14 * dir},${y} L ${m - 5 * dir},${y - 10} L ${m + 5 * dir},${y + 10} L ${m + 14 * dir},${y} L ${x2},${y}`;
}
