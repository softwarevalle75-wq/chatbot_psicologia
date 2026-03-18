/**
 * Fuentes de manuales psicológicos para el RAG.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "../../data/manuales");

export interface SourceConfig {
  name:       string;
  manualPath: string;
  docId:      string;
  docName:    string;
  source:     string;
  version:    string;
  enabled:    boolean;
}

export const TEST_SOURCES: Record<string, SourceConfig> = {
  "GHQ-12-1": {
    manualPath: path.join(DATA_DIR, "GHQ12/ruiz-et-al.-2017-ghq-12-colombia-1.pdf"),
    docId:      "ruiz-et-al.-2017-ghq-12-colombia-1.pdf",
    docName:    "ruiz-et-al.-2017-ghq-12-colombia-1.pdf",
    source:     "GHQ-12",
    version:    "v1",
    enabled:    true,
    name:       "GHQ-12-1",
  },
  "GHQ-12-2": {
    manualPath: path.join(DATA_DIR, "GHQ12/GHQ12 fiabilidad, validez y estructura factorial..pdf"),
    docId:      "GHQ12 fiabilidad, validez y estructura factorial..pdf",
    docName:    "GHQ12 fiabilidad, validez y estructura factorial..pdf",
    source:     "GHQ-12",
    version:    "v1",
    enabled:    true,
    name:       "GHQ-12-2",
  },
  "DASS-21-1": {
    manualPath: path.join(DATA_DIR, "DASS21/ruiz2017dass21-1.pdf"),
    docId:      "ruiz2017dass21-1.pdf",
    docName:    "ruiz2017dass21-1.pdf",
    source:     "DASS-21",
    version:    "v1",
    enabled:    true,
    name:       "DASS-21-1",
  },
  "DASS-21-2": {
    manualPath: path.join(DATA_DIR, "DASS21/dass-21-2.pdf"),
    docId:      "dass-21-2.pdf",
    docName:    "dass-21-2.pdf",
    source:     "DASS-21",
    version:    "v1",
    enabled:    true,
    name:       "DASS-21-2",
  },
};

export function getEnabledSources(): SourceConfig[] {
  return Object.values(TEST_SOURCES).filter((s) => s.enabled);
}
