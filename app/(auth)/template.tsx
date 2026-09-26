import { PageReveal } from "@/components/motion/PageReveal";

export default function AuthTemplate({ children }: { children: React.ReactNode }) {
  return <PageReveal>{children}</PageReveal>;
}
