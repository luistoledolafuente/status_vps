// Reusable Card backed by HeroUI v3's compound Card component.

import { Card as HeroCard } from "@heroui/react";

export function Card({ title, subtitle, actions, children, className = "" }) {
  return (
    <HeroCard className={className}>
      {title || actions ? (
        <HeroCard.Header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <HeroCard.Title className="text-base font-semibold">{title}</HeroCard.Title> : null}
            {subtitle ? (
              <HeroCard.Description className="mt-0.5">{subtitle}</HeroCard.Description>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </HeroCard.Header>
      ) : null}
      <HeroCard.Content>{children}</HeroCard.Content>
    </HeroCard>
  );
}