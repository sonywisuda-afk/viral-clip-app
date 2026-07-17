// Sprint 03d (Export Center roadmap) - the client-facing shape for a user's
// Brand Kit. logoUrl is a `/brand-kit/logo` endpoint path, never the raw
// storage key - same convention as every other resource. Null fields mean
// "not set yet", not an error - Brand Report degrades to default styling.
export interface BrandKitDto {
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}
