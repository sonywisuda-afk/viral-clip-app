// Sprint 5C (Comments).
export interface CommentMentionDto {
  userId: string;
  email: string;
}

// Aggregated by emoji (not one row per reaction) - a comment with 3 people
// reacting 👍 renders as one badge with a count, not three, same shape any
// Slack/Figma-style reaction bar needs. `reactedByMe` lets the frontend
// toggle the requester's own reaction without a second lookup.
export interface CommentReactionSummaryDto {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface CommentAttachmentDto {
  id: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  url: string;
}

export interface CommentDto {
  id: string;
  videoId: string;
  clipId: string | null;
  authorId: string;
  authorEmail: string;
  parentId: string | null;
  body: string;
  timestampSeconds: number | null;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedByEmail: string | null;
  editedAt: string | null;
  createdAt: string;
  mentions: CommentMentionDto[];
  reactions: CommentReactionSummaryDto[];
  attachments: CommentAttachmentDto[];
}

export interface CommentListDto {
  comments: CommentDto[];
}
