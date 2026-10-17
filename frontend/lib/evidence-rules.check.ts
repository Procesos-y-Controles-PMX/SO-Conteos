// Run: npx tsx lib/evidence-rules.check.ts
import assert from "node:assert/strict";
import { evidenceFiles, missingEvidenceKind, sessionWasStarted, type CountLine } from "./types";

const base: CountLine = { sku: "A", nombre: "x", um: "EA", teorico: 0, fisico: 0, pendienteEntregar: 0, pendienteFacturar: 0, danado: 0 };
assert.equal(missingEvidenceKind(base), undefined);
assert.equal(missingEvidenceKind({ ...base, fisico: 2 }), "general");
assert.equal(missingEvidenceKind({ ...base, fisico: 2, evidenciaPath: "c/A/ev.jpg" }), undefined, "legacy column counts");
assert.equal(missingEvidenceKind({ ...base, pendienteEntregar: 1 }), "entregar");
assert.equal(missingEvidenceKind({ ...base, danado: 3, evidencias: [{ kind: "entregar", path: "p" }] }), "danado");
const two = { ...base, pendienteFacturar: 1, evidenciaFacturarPath: "old", evidencias: [{ kind: "facturar" as const, path: "new" }] };
assert.deepEqual(evidenceFiles(two, "facturar").map((f) => f.path), ["old", "new"]);
assert.equal(sessionWasStarted({ lines: [{ ...base, fisico: null, danado: 1 }] }), true);
console.log("evidence rules ok");
