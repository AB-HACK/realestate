import { create } from "zustand";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  add: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (toast) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    const duration = toast.duration ?? 4000;
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(opts: Omit<Toast, "id">) {
  useToastStore.getState().add(opts);
}

toast.success = (title: string, message?: string) => toast({ type: "success", title, message });
toast.error = (title: string, message?: string) => toast({ type: "error", title, message });
toast.info = (title: string, message?: string) => toast({ type: "info", title, message });
toast.warning = (title: string, message?: string) => toast({ type: "warning", title, message });

const typeConfig: Record<ToastType, string> = {
  success: "border-l-success",
  error: "border-l-destructive",
  info: "border-l-info",
  warning: "border-l-warning",
};

const iconMap: Record<ToastType, string> = {
  success: "M5 13l4 4L19 7",
  error: "M6 18L18 6M6 6l12 12",
  info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  warning: "M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z",
};

const textColorMap: Record<ToastType, string> = {
  success: "text-success",
  error: "text-destructive",
  info: "text-info",
  warning: "text-warning",
};

export function ToastContainer() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 sm:bottom-6 sm:right-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 rounded-lg border border-border border-l-4 ${typeConfig[t.type]} bg-card p-4 shadow-lg animate-in slide-in-from-right-full duration-300`}
        >
          <svg className={`mt-0.5 h-5 w-5 shrink-0 ${textColorMap[t.type]}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={iconMap[t.type]} />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t.title}</p>
            {t.message && <p className="mt-0.5 text-xs text-muted-foreground">{t.message}</p>}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
