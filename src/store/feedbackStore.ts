import { create } from 'zustand';

export type NoticeKind = 'error' | 'success' | 'info';

export interface Notice {
  id: number;
  kind: NoticeKind;
  message: string;
}

interface FeedbackState {
  notice: Notice | null;
  notify: (kind: NoticeKind, message: string) => void;
  dismiss: () => void;
}

// An error stays until it is dismissed — it says something did not happen, and
// a line that fades on its own can be missed. Anything else is a passing
// acknowledgement and leaves by itself.
const AUTO_DISMISS_MS = 4000;
let timer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;

export const useFeedbackStore = create<FeedbackState>((set, get) => ({
  notice: null,

  notify(kind, message) {
    // The same line again is one problem, not two: keep what is on screen.
    const current = get().notice;
    if (current && current.kind === kind && current.message === message) return;
    if (timer) clearTimeout(timer);
    const id = ++seq;
    set({ notice: { id, kind, message } });
    if (kind !== 'error') {
      timer = setTimeout(() => {
        if (get().notice?.id === id) set({ notice: null });
      }, AUTO_DISMISS_MS);
    }
  },

  dismiss() {
    if (timer) clearTimeout(timer);
    set({ notice: null });
  },
}));

/** For stores and libs, which have no hook. */
export const notify = (kind: NoticeKind, message: string) =>
  useFeedbackStore.getState().notify(kind, message);
