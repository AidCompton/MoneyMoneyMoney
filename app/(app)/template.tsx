import { PageReveal } from "@/components/motion/PageReveal";

// Templates remount on every navigation, so each page gets its entrance.
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <PageReveal>{children}</PageReveal>;
}
