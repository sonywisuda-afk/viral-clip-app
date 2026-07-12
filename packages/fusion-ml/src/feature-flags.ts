// Milestone 2A: this codebase has no prior feature-flag convention (grepped
// the whole repo - zero existing "featureFlag"/"isEnabled" pattern). This
// establishes one fresh: a boolean env var, read lazily (function body, not
// a module-level const) so it isn't captured before dotenv's config() call
// runs elsewhere in the process - the same load-order-safety reason
// packages/storage's getClient()/bucket() read process.env lazily inside
// their own function bodies rather than at module top-level.
//
// Nothing calls this function yet - v3 has no real Predictor, so there's
// nothing for the flag to gate. It exists, tested, and documented (see
// docs/ai/fusion-v3.md's "Rollback strategy" section) so a future milestone
// that actually wires a v3 Predictor into render-clip.worker.ts can use it
// immediately instead of inventing its own toggle.
export function isFusionV3Enabled(): boolean {
  return process.env.FUSION_ENGINE_V3_ENABLED === 'true';
}
