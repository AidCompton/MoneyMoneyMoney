import Link from "next/link";

/** Three stacked coins rising — the "MoneyMoneyMoney" mark. */
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#16a06e" />
          <stop offset="55%" stopColor="#4fe3a5" />
          <stop offset="100%" stopColor="#f7c35c" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="12" fill="url(#logo-g)" />
      <path
        d="M9 29V17l6 7 5-9 5 9 6-7v12"
        fill="none"
        stroke="#06110d"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3" aria-label="MoneyMoneyMoney home">
      <LogoMark className="h-9 w-9 transition-transform duration-500 group-hover:rotate-[-8deg] group-hover:scale-105" />
      <span className="hidden text-[15px] font-bold tracking-tight text-ivory md:inline">
        Money<span className="font-accent text-gold">Money</span>Money
      </span>
    </Link>
  );
}
