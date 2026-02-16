import { type ButtonHTMLAttributes } from 'react';
import { Spinner } from './Spinner';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const base =
    'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-2 font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50';

  const variants = {
    primary:
      'border border-cyan-200/55 bg-gradient-to-r from-sky-400 to-cyan-500 text-slate-950 shadow-[0_10px_24px_rgba(14,165,233,0.35)] hover:-translate-y-0.5 hover:from-sky-300 hover:to-cyan-400',
    secondary:
      'border border-border bg-surface/75 text-text-main hover:-translate-y-0.5 hover:border-cyan-200/45 hover:bg-surface-hover/75',
    danger:
      'border border-red-300/40 bg-red-500/85 text-white hover:-translate-y-0.5 hover:bg-red-500',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
