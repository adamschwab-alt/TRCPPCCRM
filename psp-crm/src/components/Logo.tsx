/**
 * PSP wordmark (light branding, §8). Swap for the real logo by dropping
 * /public/psp-logo.svg and replacing this with an <img src="/psp-logo.svg" />.
 */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-brand font-mono text-sm font-bold text-white">
        PS
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-sm font-bold tracking-tight text-charcoal">PACIFIC SHORING</span>
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
          Coverage CRM
        </span>
      </span>
    </span>
  );
}
