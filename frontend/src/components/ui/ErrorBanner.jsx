// ErrorBanner: global error with a retry action, built on HeroUI's Alert.

import { Alert, Button } from "@heroui/react";

export function ErrorBanner({ error, onRetry, hint }) {
  return (
    <Alert status="danger" className="rounded-2xl">
      <Alert.Content className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Alert.Title>Error al consultar el servidor</Alert.Title>
            <Alert.Description>
              {error?.message ?? "Comprueba que el backend esté corriendo."}
              {hint ? (
                <>
                  <br />
                  {hint}
                </>
              ) : null}
            </Alert.Description>
          </div>
          {onRetry ? (
            <Button variant="danger" size="sm" className="shrink-0" onPress={onRetry}>
              Reintentar
            </Button>
          ) : null}
        </div>
      </Alert.Content>
    </Alert>
  );
}