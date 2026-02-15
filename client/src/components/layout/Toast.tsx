import type { Toast as ToastType } from '../../stores/ui-store';
import { useUIStore } from '../../stores/ui-store';

const typeStyles: Record<ToastType['type'], string> = {
  info: 'bg-primary',
  success: 'bg-success',
  error: 'bg-danger',
  warning: 'bg-warning',
};

export function Toast({ toast }: { toast: ToastType }) {
  const removeToast = useUIStore((s) => s.removeToast);

  return (
    <div
      className={`${typeStyles[toast.type]} flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg`}
    >
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="cursor-pointer text-white/80 hover:text-white"
      >
        x
      </button>
    </div>
  );
}
