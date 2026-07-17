'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { brandKitLogoUrl, getBrandKit, updateBrandKit, uploadBrandLogo } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

// Sprint 03d/03e - the minimal Brand Kit Brand Report reads. Deliberately
// no "Save" gate on the logo upload (uploads immediately on file select,
// matching common upload UX) - only the two colors are batched behind a
// Save button, since typing a hex value mid-edit shouldn't fire a request
// per keystroke.
export function BrandKitTab() {
  const { data: brandKit, mutate } = useSWR('brand-kit', getBrandKit);
  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const primary = primaryColor || brandKit?.primaryColor || '';
  const secondary = secondaryColor || brandKit?.secondaryColor || '';

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const updated = await uploadBrandLogo(file);
      await mutate(updated, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah logo');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleSaveColors() {
    setError(null);
    if (primary && !HEX_COLOR_PATTERN.test(primary)) {
      setError('Warna utama harus format hex, contoh: #1D4ED8');
      return;
    }
    if (secondary && !HEX_COLOR_PATTERN.test(secondary)) {
      setError('Warna sekunder harus format hex, contoh: #1D4ED8');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateBrandKit({
        primaryColor: primary || undefined,
        secondaryColor: secondary || undefined,
      });
      await mutate(updated, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan warna');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          Logo Brand
        </p>
        <div className="flex items-center gap-3">
          {brandKit?.logoUrl ? (
            <img
              src={brandKitLogoUrl()}
              crossOrigin="use-credentials"
              alt="Logo brand"
              className="h-14 w-14 rounded-md border border-border object-contain bg-slate-panel"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-border font-mono text-[10px] text-muted-foreground">
              Kosong
            </div>
          )}
          <label>
            <Button size="sm" variant="outline" asChild disabled={uploading}>
              <span>{uploading ? 'Mengunggah...' : 'Unggah Logo'}</span>
            </Button>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          Warna Brand
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={HEX_COLOR_PATTERN.test(primary) ? primary : '#000000'}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-9 w-9 rounded border border-border bg-transparent"
              aria-label="Warna utama"
            />
            <Input
              value={primary}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#1D4ED8"
              className="w-28"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={HEX_COLOR_PATTERN.test(secondary) ? secondary : '#000000'}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="h-9 w-9 rounded border border-border bg-transparent"
              aria-label="Warna sekunder"
            />
            <Input
              value={secondary}
              onChange={(e) => setSecondaryColor(e.target.value)}
              placeholder="#1D4ED8"
              className="w-28"
            />
          </div>
          <Button size="sm" disabled={saving} onClick={handleSaveColors}>
            {saving ? 'Menyimpan...' : 'Simpan Warna'}
          </Button>
        </div>
      </div>

      {error && <p className="font-body text-xs text-destructive">{error}</p>}
    </div>
  );
}
