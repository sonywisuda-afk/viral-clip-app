'use client';

import type { ClipEngineExplainability } from '@speedora/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ExplainabilityDetailPanel } from '../../../../components/explainability/ExplainabilityDetailPanel';
import { ExplainabilityTimeline } from '../../../../components/explainability/ExplainabilityTimeline';
import { Nav } from '../../../../components/Nav';
import { getClipExplainability, getVideo, type VideoWithClipsDto } from '../../../../lib/api';
import { useAuth } from '../../../../lib/useAuth';

// Milestone 4 (AI Explainability) - standalone page (parallel to
// /videos/:id/ocr-review), read-only. Fetches getVideo() once for the clip
// list (cheap - already includes every highlight* field per clip, used for
// the timeline overview and picking an initial selection), then lazily
// calls getClipExplainability() for only the currently-selected clip's
// detail panel - a real per-clip round trip is worth it for a page most
// users won't select every clip on.
export default function ExplainabilityPage({ params }: { params: { id: string } }) {
  const { user, checkingAuth, logout } = useAuth();
  const [video, setVideo] = useState<VideoWithClipsDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [results, setResults] = useState<ClipEngineExplainability[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    getVideo(params.id)
      .then((v) => {
        if (cancelled) return;
        setVideo(v);
        // Default to the first scored clip, if any - otherwise just the
        // first clip (so the detail panel has something to try loading and
        // can report "not scored" honestly rather than showing nothing).
        const scored = v.clips.find((c) => c.highlightScore !== null);
        setSelectedClipId((scored ?? v.clips[0])?.id ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memuat video');
      });

    return () => {
      cancelled = true;
    };
  }, [user, params.id]);

  useEffect(() => {
    if (!selectedClipId) return;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);

    getClipExplainability(selectedClipId)
      .then((dto) => {
        if (!cancelled) setResults(dto.results);
      })
      .catch((err) => {
        if (!cancelled) {
          setDetailError(err instanceof Error ? err.message : 'Gagal memuat penjelasan klip');
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClipId]);

  return (
    <main className="min-h-screen bg-background px-6 py-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-xl uppercase tracking-wide text-foreground">Speedora</h1>
        <p className="mt-1 font-body text-sm text-muted-foreground">
          AI Explainability — kenapa AI memilih klip ini, seberapa yakin, dan sinyal apa yang paling
          berpengaruh.
        </p>

        {checkingAuth ? null : !user ? (
          <p className="mt-8 font-body text-sm text-muted-foreground">
            <Link href="/upload" className="underline">
              Masuk
            </Link>{' '}
            untuk melihat penjelasan AI video kamu.
          </p>
        ) : (
          <>
            <Nav user={user} onLogout={logout} />

            {error && <p className="mt-4 font-body text-sm text-destructive">{error}</p>}

            {!error && video ? (
              <div className="mt-4 space-y-6">
                <ExplainabilityTimeline
                  clips={video.clips}
                  duration={video.durationSeconds}
                  selectedClipId={selectedClipId}
                  onSelectClip={setSelectedClipId}
                />
                <ExplainabilityDetailPanel results={results} loading={detailLoading} error={detailError} />
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
