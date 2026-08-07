import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/sendell/app-shell";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [{ title: "Sendell Remote Control" }],
  }),
});

function HomePage() {
  return <AppShell />;
}
