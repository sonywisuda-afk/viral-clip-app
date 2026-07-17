import { create } from 'zustand';

// Notification Center Sprint 4A - the first toast/transient-popup UI in
// this app (confirmed via grep: no Radix Toast, no other toast library
// anywhere). Reuses zustand (already a dependency, see timelineStore.ts)
// rather than adding a new Radix package for a single small utility.

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone: 'good' | 'neutral' | 'bad';
}

interface ToastState {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: string) => void;
}

const AUTO_DISMISS_MS = 5000;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (item) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { ...item, id }] }));
    setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

// Plain function form for call sites that aren't already inside a component
// re-rendering on store changes (e.g. an SWR onSuccess callback) - same
// "getState() for imperative access outside React's render cycle" pattern
// zustand itself documents.
export function toast(item: Omit<ToastItem, 'id'>): void {
  useToastStore.getState().push(item);
}
