import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Sprint 5A (Collaboration Foundation) - the frontend's "which workspace am
// I looking at" selection. Reuses zustand (already a dependency, see
// toast-store.ts/timelineStore.ts) with its persist middleware so the
// choice survives a refresh, same role a cookie would play but without
// needing a Server Component-side read for this MVP - every existing
// server-scoped read (getServerVideos, etc.) still defaults to the
// requester's personal workspace when no workspaceId is passed, so a user
// who never touches this store sees zero behavior change.
interface WorkspaceState {
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      activeWorkspaceId: null,
      setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
    }),
    { name: 'speedora-active-workspace' },
  ),
);
