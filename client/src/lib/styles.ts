/*--Shared class names for form fields and buttons, so every form on the site looks the same--*/

export const fieldClass =
  "w-full rounded-xl border border-brand-navy/10 bg-white px-4 py-3 text-[15px] text-brand-navy shadow-[0_1px_2px_rgb(25_42_61/0.04)] transition-[border-color,box-shadow] duration-200 placeholder:text-slate-400 hover:border-brand-navy/20 focus:border-brand-green focus:ring-4 focus:ring-brand-green/10 focus:outline-none aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:ring-red-500/10";

export const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-full bg-brand-green px-10 py-3.5 text-sm font-semibold tracking-wide text-white shadow-[0_8px_24px_-8px_rgb(9_120_52/0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#0a8a3c] active:translate-y-0 disabled:pointer-events-none disabled:opacity-60";

/*--A white panel that holds a form or a result--*/
export const panelClass =
  "rounded-[2rem] border border-brand-navy/5 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-10";
