// Skeleton: loading placeholder rows backed by HeroUI's Skeleton component.

import { Skeleton as HeroSkeleton } from "@heroui/react";

export function Skeleton({ className = "", rows = 1 }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, index) => (
        <HeroSkeleton key={index} className="h-8 rounded-lg" animationType="pulse" />
      ))}
    </div>
  );
}