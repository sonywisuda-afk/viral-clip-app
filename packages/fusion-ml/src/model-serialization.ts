// A "model" is deliberately opaque here (see interfaces.ts's ModelTrainer
// comment) - for the mock/baseline trainer this milestone ships
// (src/mock/mock-model-trainer.ts), it's a plain JSON-serializable object,
// so a real JSON round-trip genuinely exercises this. A future real trainer
// (a GBT booster, etc.) would likely need a different serialization format
// entirely - this function's job is to define the seam, not to anticipate
// every future model type.
export function serializeModel(model: unknown): string {
  return JSON.stringify(model);
}

export function deserializeModel(data: string): unknown {
  return JSON.parse(data);
}
