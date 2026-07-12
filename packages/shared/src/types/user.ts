// Mirrors UserRole in packages/database's Prisma schema. Milestone 5C-B
// (AI Operations Dashboard) - the first role concept in this codebase.
// CREATOR is every normal signup; the other three gate GET /ops/ai/*
// (system-wide aggregate data, not any one user's own).
export enum UserRole {
  CREATOR = 'CREATOR',
  ADMIN = 'ADMIN',
  AI_ENGINEER = 'AI_ENGINEER',
  OPERATOR = 'OPERATOR',
}
