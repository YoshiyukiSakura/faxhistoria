import type { Toast as ToastType } from '../../stores/ui-store';
import { useUIStore } from '../../stores/ui-store';

const typeStyles: Record<ToastType['type'], string> = {
  info: 'border-cyan-200/45 bg-cyan-400/18 text-cyan-100',
  success: 'border-emerald-200/45 bg-emerald-400/18 text-emerald-100',
  error: 'border-red-200/45 bg-red-500/16 text-red-100',
  warning: 'border-amber-200/45 bg-amber-400/16 text-amber-100',
};

export function Toast({ toast }: { toast: ToastType }) {
  const removeToast = useUIStore((s) => s.removeToast);

  return (
    <div
      className={`${typeStyles[toast.type]} flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-[0_14px_36px_rgba(2,6,23,0.52)] backdrop-blur-md`}
    >
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="cursor-pointer text-current/80 hover:text-current"
      >
        x
      </button>
    </div>
  );
}
