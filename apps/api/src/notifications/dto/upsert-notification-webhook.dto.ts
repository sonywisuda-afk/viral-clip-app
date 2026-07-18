import { IsUrl } from 'class-validator';

// Milestone 04d - HTTPS-only (Slack/Discord webhook URLs and any sane
// generic receiving endpoint are always HTTPS; a plaintext http:// leak of
// this URL is exactly the credential leak the AES-256-GCM storage exists to
// prevent, so accepting one at all would be a self-defeating hole).
export class UpsertNotificationWebhookDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url!: string;
}
