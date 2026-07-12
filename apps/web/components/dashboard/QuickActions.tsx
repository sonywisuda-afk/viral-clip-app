import { Download, FolderPlus, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { dashboardExportCsvUrl } from '@/lib/api';
import { InviteMemberDialog } from './InviteMemberDialog';

// "Create Project" is deliberately an alias for the same upload flow as
// "Upload Video" - there is no Project grouping entity in this schema
// (videos are the top-level unit), so this button exists for
// discoverability/Opus-Clip-familiarity, not a new backend concept.
export function QuickActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild>
        <Link href="/">
          <UploadCloud className="mr-2 h-4 w-4" aria-hidden="true" />
          Upload Video
        </Link>
      </Button>
      <Button variant="outline" asChild>
        <Link href="/">
          <FolderPlus className="mr-2 h-4 w-4" aria-hidden="true" />
          Create Project
        </Link>
      </Button>
      <InviteMemberDialog />
      <Button variant="outline" asChild>
        <a href={dashboardExportCsvUrl()}>
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          Export Report
        </a>
      </Button>
    </div>
  );
}
