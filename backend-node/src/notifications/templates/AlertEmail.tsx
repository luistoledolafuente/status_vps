// Plantilla de alerta para correo construida con React Email.
// Se renderiza a HTML en el EmailNotifier y se envía por SMTP.

import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from "react-email";

export interface AlertEmailProps {
  event?: string;
  severity?: string;
  title?: string;
  message?: string;
  tip?: string;
  metric?: string | null;
  value?: number | null;
  threshold?: number | null;
  hostname?: string;
  timestamp?: string;
}

const PALETTE: Record<string, { badge: string; soft: string; border: string }> = {
  critical: { badge: "#dc2626", soft: "#fef2f2", border: "#fecaca" },
  warning: { badge: "#d97706", soft: "#fffbeb", border: "#fde68a" },
  info: { badge: "#0284c7", soft: "#f0f9ff", border: "#bae6fd" },
};

function severityLabel(severity?: string): string {
  if (severity === "critical") return "Crítica";
  if (severity === "warning") return "Advertencia";
  return "Informativa";
}

const baseFont =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const monoFont = 'Menlo, Consolas, "Courier New", monospace';

const detailLabel = {
  margin: 0,
  fontSize: 11,
  fontWeight: 700,
  color: "#71717a",
  letterSpacing: 0.8,
  textTransform: "uppercase" as const,
};

export function AlertEmail({
  event = "alert",
  severity = "info",
  title = "Alerta del servidor",
  message,
  tip,
  metric,
  value,
  threshold,
  hostname,
  timestamp,
}: AlertEmailProps) {
  const colors = PALETTE[severity] ?? PALETTE.info;
  const resolved = event === "alert_resolved";
  const metricLine = `${metric ?? "—"}${value != null ? ` = ${value}` : ""}${threshold != null ? ` (umbral ${threshold})` : ""}`;

  return (
    <Html lang="es">
      <Head />
      <Preview>
        {resolved ? "Restaurado: " : "Alerta: "}
        {title} · {hostname ?? "servidor"}
      </Preview>
      <Body style={{ margin: 0, padding: "24px 8px", backgroundColor: "#f4f4f5", fontFamily: baseFont }}>
        <Container
          style={{
            maxWidth: 560,
            margin: "0 auto",
            backgroundColor: "#ffffff",
            borderRadius: 14,
            border: "1px solid #e4e4e7",
            overflow: "hidden",
          }}
        >
          <Section style={{ backgroundColor: colors.badge, padding: "14px 28px" }}>
            <Text
              style={{
                margin: 0,
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 1.2,
                textTransform: "uppercase",
              }}
            >
              System Status {resolved ? "· restaurado" : `· ${severityLabel(severity)}`}
            </Text>
          </Section>

          <Section style={{ padding: "24px 28px" }}>
            <Text style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#18181b" }}>
              {title}
            </Text>
            {message ? (
              <Text style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.55, color: "#3f3f46" }}>
                {message}
              </Text>
            ) : null}
          </Section>

          <Section style={{ padding: "0 28px 24px" }}>
            <Row
              style={{
                background: colors.soft,
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                padding: "14px 16px",
              }}
            >
              <Text style={detailLabel}>Métrica</Text>
              <Text style={{ margin: "2px 0 0", fontSize: 13, color: "#18181b", fontFamily: monoFont }}>
                {metricLine}
              </Text>
              <Text style={{ ...detailLabel, marginTop: 12 }}>Host</Text>
              <Text style={{ margin: "2px 0 0", fontSize: 13, color: "#18181b", fontFamily: monoFont }}>
                {hostname ?? "—"}
              </Text>
              {timestamp ? (
                <>
                  <Text style={{ ...detailLabel, marginTop: 12 }}>Fecha</Text>
                  <Text style={{ margin: "2px 0 0", fontSize: 13, color: "#18181b", fontFamily: monoFont }}>
                    {timestamp}
                  </Text>
                </>
              ) : null}
            </Row>
          </Section>

          {tip ? (
            <Section style={{ padding: "0 28px 24px" }}>
              <Text style={{ ...detailLabel, color: "#71717a" }}>Sugerencia</Text>
              <Text style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.5, color: "#3f3f46" }}>
                {tip}
              </Text>
            </Section>
          ) : null}

          <Hr style={{ margin: 0, borderColor: "#e4e4e7" }} />
          <Section style={{ padding: "14px 28px 18px" }}>
            <Text style={{ margin: 0, fontSize: 12, color: "#a1a1aa" }}>
              System Status · correo automático enviado por el monitor del servidor
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}