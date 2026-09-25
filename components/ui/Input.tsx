import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";

export const fieldClasses =
  "w-full min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[15px] text-ivory placeholder:text-ivory/30 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] transition-[border-color,background-color,box-shadow] duration-300 hover:border-white/20 focus:border-gold/60 focus:bg-white/[0.07] focus:shadow-[0_0_0_4px_rgb(247_195_92/0.12)] focus:outline-none";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...props }, ref) {
    return <input ref={ref} className={`${fieldClasses} ${className}`} {...props} />;
  },
);

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldClasses} leading-relaxed ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${fieldClasses} appearance-none bg-no-repeat ${className}`} {...props} />;
}

export function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-ivory/55"
    >
      {children}
    </label>
  );
}
