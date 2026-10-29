// VSM data sources — where a project's process figures come from. The calculation engine (../vsmCalc.ts)
// never knows the source; it only receives VsmProcess rows.
//
//   manual    Gemba Tools today and the stand-alone app: figures typed into the VSM tabs.
//   import    Stand-alone app / Gemba Tools: an Excel field form or another panel (plan step V8).
//   opxSuite  Inside Opx Suite: per line, the machine / process cards (C/T, machines, operators, shifts),
//             work-order closings (quantity, scrap, run time) and machine OEE / downtime, filtered by
//             line + product + date range. Connected to the Opx Suite database when the module is split
//             out (plan step V11).
//
// A pull is stored on the project as a snapshot (`VsmProject.dataSource` + the process rows), so later
// changes in the source never silently change a saved map; pulling again makes a new version (V7).
import type { VsmDataSourceKind, VsmProcess } from "../vsmTypes";

export interface VsmLineOption { id: string; name: string }
export interface VsmProductOption { id: string; name: string; code?: string; quantity?: number }

export interface VsmSnapshotRequest {
  lineId: string;
  productId?: string;
  from: string;   // ISO date, inclusive
  to: string;     // ISO date, inclusive
}

// One field's origin, shown next to the value ("Opx Suite · iş emri kapamaları 01.10–28.10").
export interface VsmFieldSource {
  field: keyof VsmProcess;
  source: string;
}

export interface VsmProcessSnapshot {
  processes: VsmProcess[];
  fieldSources: Record<string, VsmFieldSource[]>;   // keyed by process id
  pulledAt: string;
  warnings: string[];                               // e.g. "Hat X için iş emri kapaması yok"
}

export interface VsmDataSource {
  kind: VsmDataSourceKind;
  label: string;
  // False when this host has no connection for the source (the UI then hides it).
  available: boolean;
  listLines(): Promise<VsmLineOption[]>;
  listProducts(lineId: string, from: string, to: string): Promise<VsmProductOption[]>;
  loadProcessSnapshot(req: VsmSnapshotRequest): Promise<VsmProcessSnapshot>;
}
