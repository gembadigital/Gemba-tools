// Registry of VSM data sources. The host app decides which are available (Gemba Tools: manual only).
import type { VsmDataSourceKind } from "../vsmTypes";
import type { VsmDataSource } from "./types";
import { manualSource } from "./manual";
import { opxSuiteSource } from "./opxSuite";

export type { VsmDataSource } from "./types";

const SOURCES: Record<VsmDataSourceKind, VsmDataSource | undefined> = {
  manual: manualSource,
  import: undefined,      // plan step V8 (Excel field form)
  opxSuite: opxSuiteSource
};

export const availableDataSources = (): VsmDataSource[] =>
  Object.values(SOURCES).filter((s): s is VsmDataSource => !!s && s.available);

export const dataSourceLabel = (kind?: VsmDataSourceKind) => SOURCES[kind || "manual"]?.label || "Elle giriş";
