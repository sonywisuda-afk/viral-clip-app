'use client';

import { Download, FolderPlus, UploadCloud } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { dashboardExportCsvUrl } from '@/lib/api';

// Code-split (Product Experience performance pass) - the Dialog/Radix
// content is only needed once a user actually clicks "Invite Member", not
// on every dashboard load. `ssr: false` since it's a client-only
// interactive dialog with no meaningful server-rendered fallback state.
const WorkspaceMembersDialog = dynamic(
  () => import('./WorkspaceMembersDialog').then((mod) => mod.WorkspaceMembersDialog),
  {
    ssr: false,
    loading: () => (
      <Button variant="outline" disabled>
        Invite Member
      </Button>
    ),
  },
);

// "Create Project" is still an alias for the same upload flow as "Upload
// Video", not wired to Sprint 5A's new real Project entity
// (packages/database's Project model + POST /workspaces/:id/projects) -
// building a Project/Folder picker into the upload flow is out of scope for
// this pass (a dedicated Project/Folder sidebar UI is the deferred next
// step, see the Sprint 5A plan). Both link to /upload (the actual
// authenticated upload flow), not / (the public marketing landing page).
export function QuickActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild>
        <Link href="/upload">
          <UploadCloud className="mr-2 h-4 w-4" aria-hidden="true" />
          Upload Video
        </Link>
      </Button>
      <Button variant="outline" asChild>
        <Link href="/upload">
          <FolderPlus className="mr-2 h-4 w-4" aria-hidden="true" />
          Create Project
        </Link>
      </Button>
      <WorkspaceMembersDialog />
      <Button variant="outline" asChild>
        <a href={dashboardExportCsvUrl()}>
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          Export Report
        </a>
      </Button>
    </div>
  );
}
