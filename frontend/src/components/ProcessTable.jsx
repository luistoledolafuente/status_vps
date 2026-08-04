// Process table: top processes by CPU or memory, with search and pagination.

import { useEffect, useMemo, useState } from "react";
import { Button, SearchField, Table, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { Card } from "./ui/Card";
import { EmptyState } from "./ui/EmptyState";
import { Skeleton } from "./ui/Skeleton";
import { formatBytes, formatPercent } from "../utils/format";

const STATUS_LABELS = {
  running: "En ejecución",
  sleeping: "En espera",
  stopped: "Detenido",
  zombie: "Zombie",
  idle: "Inactivo",
};

const SORT_OPTIONS = [
  { value: "cpu", label: "Por CPU" },
  { value: "memory", label: "Por memoria" },
];

export function ProcessTable({ processes = [], loading, sortBy, onSortChange, searchable = true, compact = false }) {
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(compact ? 5 : 10);

  useEffect(() => {
    setVisible(compact ? 5 : 10);
  }, [sortBy, compact]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return processes;
    return processes.filter((p) =>
      `${p.name} ${p.username} ${p.pid}`.toLowerCase().includes(term)
    );
  }, [processes, query]);

  const sortButtons = (
    <div className="-mx-1 overflow-x-auto rounded-xl px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ToggleButtonGroup
        size="sm"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[sortBy]}
        onSelectionChange={(keys) => {
          const key = [...keys][0];
          if (key) onSortChange(String(key));
        }}
      >
        {SORT_OPTIONS.map((option, index) => (
          <ToggleButton key={option.value} id={option.value}>
            {index > 0 ? <ToggleButtonGroup.Separator /> : null}
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );

  return (
    <Card
      title="Procesos más pesados"
      subtitle={processes.length ? `${processes.length} procesos · actualiza cada 10 s` : undefined}
      actions={sortButtons}
    >
      {searchable ? (
        <div className="mb-3">
          <SearchField aria-label="Buscar proceso o usuario" value={query} onChange={setQuery} fullWidth>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Buscar proceso o usuario…" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </div>
      ) : null}

      {loading && processes.length === 0 ? (
        <Skeleton rows={compact ? 5 : 8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={query ? `Sin coincidencias para «${query}»` : "No se pudieron leer los procesos"}
          description="Intenta con otro término de búsqueda."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="Procesos del sistema">
                <Table.Header>
                  <Table.Column isRowHeader>Proceso</Table.Column>
                  <Table.Column>PID</Table.Column>
                  <Table.Column className="hidden sm:table-cell">Estado</Table.Column>
                  <Table.Column className="text-right">CPU</Table.Column>
                  <Table.Column className="text-right">Memoria</Table.Column>
                </Table.Header>
                <Table.Body items={filtered.slice(0, visible)} renderEmptyState={() => null}>
                  {(process) => (
                    <Table.Row key={process.pid} id={process.pid}>
                      <Table.Cell>
                        <p className="font-medium text-foreground">{process.name}</p>
                        <p className="text-xs text-muted">{process.username}</p>
                      </Table.Cell>
                      <Table.Cell className="font-data text-muted">{process.pid}</Table.Cell>
                      <Table.Cell className="hidden sm:table-cell">
                        <span className="text-xs text-muted">
                          {STATUS_LABELS[process.status] ?? process.status}
                        </span>
                      </Table.Cell>
                      <Table.Cell className="font-data text-right">
                        <span className={process.cpu_percent > 50 ? "text-danger" : "text-foreground"}>
                          {formatPercent(process.cpu_percent, 1)}
                        </span>
                      </Table.Cell>
                      <Table.Cell className="font-data text-right text-foreground">
                        {formatBytes(process.memory_rss_bytes, 0)}
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </div>
      )}

      {filtered.length > visible ? (
        <Button
          fullWidth
          variant="secondary"
          className="mt-3"
          onPress={() => setVisible((count) => count + 5)}
        >
          Ver más procesos
        </Button>
      ) : null}
    </Card>
  );
}