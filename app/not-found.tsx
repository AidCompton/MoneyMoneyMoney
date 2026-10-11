import { LinkButton } from "@/components/ui/LinkButton";

export default function NotFound() {
  return (
    <div className="grid flex-1 place-items-center px-6 py-24 text-center">
      <div>
        <p className="font-display text-gradient-gold text-[clamp(6rem,20vw,12rem)] leading-none">404</p>
        <p className="mt-4 text-lg text-ivory/60">That page isn&apos;t here — maybe it was deleted.</p>
        <LinkButton href="/dashboard" className="mt-8">
          Back to overview
        </LinkButton>
      </div>
    </div>
  );
}
