import { Badge } from "@/components/ui/badge";
import type { ProviderId } from "@/lib/hub/types";
import { cn } from "@/lib/utils/cn";

const labels: Record<ProviderId, string> = {
  "grok-build": "Grok Build",
  "claude-code": "Claude Code",
  gemini: "Gemini",
  gpt: "GPT",
  simulated: "Simulated",
};

export function ProviderBadge({
  providerId,
  demo,
  className,
}: {
  providerId: ProviderId;
  demo?: boolean;
  className?: string;
}) {
  return (
    <Badge
      variant={providerId === "grok-build" ? "primary" : "default"}
      className={cn("font-mono uppercase tracking-wider", className)}
    >
      {labels[providerId] ?? providerId}
      {demo ? " · demo" : ""}
    </Badge>
  );
}
