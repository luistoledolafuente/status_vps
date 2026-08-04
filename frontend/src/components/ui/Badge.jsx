// Badge with severity-based colors (info / success / warning / critical).
// Standalone labels are rendered with HeroUI's Chip component.

import { Chip } from "@heroui/react";

const COLORS = {
  info: "accent",
  success: "success",
  warning: "warning",
  critical: "danger",
  neutral: "default",
};

export function Badge({ variant = "neutral", children }) {
  return (
    <Chip color={COLORS[variant] ?? "default"} variant="soft" size="sm">
      {children}
    </Chip>
  );
}