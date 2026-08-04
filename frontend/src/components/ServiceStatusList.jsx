// Service status: tracked services plus full list with search and state
// filters. Tracked services are always shown — resolved via systemd, daemon
// socket/CLI or process lookup — with the detection source and an actionable
// hint when a service is present but unreachable.

import { useMemo, useState } from "react";
import { Alert, Chip, SearchField, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";
import { EmptyState } from "./ui/EmptyState";
import { Skeleton } from "./ui/Skeleton";
import { StatusDot } from "./ui/StatusDot";

function StatusPill({ state, label }) {
  const color =
    state === "active"
      ? "success"
      : state === "failed"
        ? "danger"
        : state === "unreachable"
          ? "warning"
          : "default";
  return (
    <Chip color={color} variant="soft" size="sm">
      {label}
    </Chip>
  );
}

const SOURCE_LABELS = {
  systemd: "systemd",
  sysv: "init.d",
  docker: "socket/CLI",
  proceso: "proceso",
  ninguno: "sin fuente",
};

function TrackedChip({ service }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-xl bg-surface-secondary px-3 py-2 text-sm ring-1 ring-border">
      <span className="font-mono font-medium text-foreground">{service.name}</span>
      <StatusPill state={service.state} label={service.label} />
      {service.source ? (
        <span className="hidden text-[11px] text-muted sm:inline" title="Fuente de detección">
          {SOURCE_LABELS[service.source] ?? service.source}
        </span>
      ) : null}
    </span>
  );
}

function CountBadge({ label, count, variant }) {
  return (
    <Badge variant={variant}>
      <span className="font-semibold">{count}</span> {label}
    </Badge>
  );
}

const FILTERS = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
  { value: "failed", label: "Fallidos" },
  { value: "not_found", label: "No instalados" },
];

export function ServiceStatusList({ response, loading, compact = false }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const counts = response?.counts ?? {};
  const tracked = response?.tracked ?? [];

  const filtered = useMemo(() => {
    const services = response?.services ?? [];
    const term = query.trim().toLowerCase();
    return services.filter((service) => {
      if (filter !== "all" && service.active_state !== filter) return false;
      if (!term) return true;
      return `${service.name} ${service.description}`.toLowerCase().includes(term);
    });
  }, [response, query, filter]);

  const unreachableHints = tracked
    .filter((service) => service.hint)
    .map((service) => ({ name: service.name, hint: service.hint }));

  if (loading && !response) {
    return (
      <Card title="Servicios del sistema">
        <Skeleton rows={compact ? 4 : 6} />
      </Card>
    );
  }

  return (
    <Card
      title="Servicios del sistema"
      subtitle={
        response?.available
          ? `Gestor: ${response.manager ?? "no disponible"}`
          : "Listado completo no disponible en este entorno; seguimiento de servicios clave activo."
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <CountBadge label="activos" count={counts.active ?? 0} variant="success" />
          <CountBadge label="inactivos" count={counts.inactive ?? 0} variant="neutral" />
          <CountBadge label="fallidos" count={counts.failed ?? 0} variant="critical" />
        </div>
      }
    >
      {!response?.available ? (
        <Alert status="warning" className="mb-4 rounded-xl">
          <Alert.Content>
            <Alert.Title>El listado completo de servicios no está disponible en este entorno.</Alert.Title>
            {response?.detail ? <Alert.Description>{response.detail}</Alert.Description> : null}
          </Alert.Content>
        </Alert>
      ) : null}

      {tracked.length > 0 ? (
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Servicios en seguimiento
          </p>
          <div className="flex flex-wrap gap-2">
            {tracked.map((service) => (
              <TrackedChip key={service.name} service={service} />
            ))}
          </div>
          {unreachableHints.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {unreachableHints.map(({ name, hint }) => (
                <li key={name} className="flex items-start gap-2 text-xs text-muted">
                  <StatusDot state="unreachable" className="mt-0.5" />
                  <span>
                    <span className="font-semibold text-foreground">{name}:</span> {hint}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {response?.available ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <ToggleButtonGroup
              size="sm"
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[filter]}
              onSelectionChange={(keys) => {
                const key = [...keys][0];
                if (key) setFilter(String(key));
              }}
            >
              {FILTERS.map((option, index) => (
                <ToggleButton key={option.value} id={option.value}>
                  {index > 0 ? <ToggleButtonGroup.Separator /> : null}
                  {option.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <SearchField aria-label="Buscar servicio" value={query} onChange={setQuery} className="min-w-0 flex-1">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Buscar servicio…" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title={query ? `Sin coincidencias para «${query}»` : "No se encontraron servicios con este filtro"}
            />
          ) : (
            <ul className={`divide-y divide-separator overflow-y-auto rounded-xl ring-1 ring-border-secondary ${compact ? "max-h-64" : "max-h-[480px]"}`}>
              {filtered.map((service) => (
                <li key={service.name} className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-secondary">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-medium text-foreground">{service.name}</p>
                    {service.description ? (
                      <p className="truncate text-xs text-muted">{service.description}</p>
                    ) : null}
                  </div>
                  <StatusPill state={service.active_state} label={service.label} />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </Card>
  );
}