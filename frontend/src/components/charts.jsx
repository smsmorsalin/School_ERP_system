import { useId } from "react";

const palette = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#ec4899"];

function niceMax(value) {
  if (value <= 0) return 10;
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  const normalized = value / base;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * base;
}

export function AreaChart({ data = [], color = "#4f46e5", height = 250, formatValue }) {
  const gradientId = useId();
  if (!data.length) {
    return <div className="empty" style={{ padding: 30 }}>No data for this period.</div>;
  }
  const width = 680;
  const padding = { top: 14, right: 16, bottom: 30, left: 42 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const values = data.map((item) => Number(item.value) || 0);
  const max = niceMax(Math.max(...values, 1));
  const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const points = data.map((item, index) => ({
    x: padding.left + (data.length > 1 ? index * stepX : innerW / 2),
    y: padding.top + innerH - ((Number(item.value) || 0) / max) * innerH,
    ...item,
  }));
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${padding.left},${padding.top + innerH} ${line} ${
    padding.left + innerW
  },${padding.top + innerH}`;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const labelStep = Math.max(1, Math.ceil(data.length / 6));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Trend chart">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((tick) => {
        const y = padding.top + innerH - tick * innerH;
        return (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke="#eef1f6"
              strokeWidth="1"
            />
            <text x={padding.left - 9} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
              {formatValue ? formatValue(max * tick) : Math.round(max * tick)}
            </text>
          </g>
        );
      })}
      <polygon points={area} fill={`url(#${gradientId})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point, index) => (
        <g key={`${point.label}-${index}`}>
          <circle cx={point.x} cy={point.y} r={index === points.length - 1 ? 4 : 2.6} fill="#fff" stroke={color} strokeWidth="2">
            <title>{`${point.label}: ${formatValue ? formatValue(point.value) : point.value}`}</title>
          </circle>
          {index % labelStep === 0 || index === points.length - 1 ? (
            <text x={point.x} y={height - 9} textAnchor="middle" fontSize="10" fill="#94a3b8">
              {point.label}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

export function BarChart({ data = [], height = 250, color = "#4f46e5", formatValue }) {
  if (!data.length) {
    return <div className="empty" style={{ padding: 30 }}>No data to display.</div>;
  }
  const width = 680;
  const padding = { top: 16, right: 16, bottom: 32, left: 42 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const max = niceMax(Math.max(...data.map((item) => Number(item.value) || 0), 1));
  const slot = innerW / data.length;
  const barW = Math.min(46, slot * 0.55);
  const ticks = [0, 0.5, 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Bar chart">
      {ticks.map((tick) => {
        const y = padding.top + innerH - tick * innerH;
        return (
          <g key={tick}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#eef1f6" />
            <text x={padding.left - 9} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
              {formatValue ? formatValue(max * tick) : Math.round(max * tick)}
            </text>
          </g>
        );
      })}
      {data.map((item, index) => {
        const value = Number(item.value) || 0;
        const barH = (value / max) * innerH;
        const x = padding.left + slot * index + (slot - barW) / 2;
        const y = padding.top + innerH - barH;
        return (
          <g key={`${item.label}-${index}`}>
            <rect x={x} y={y} width={barW} height={Math.max(barH, 2)} rx="5" fill={item.color || color} opacity="0.9">
              <title>{`${item.label}: ${formatValue ? formatValue(value) : value}`}</title>
            </rect>
            <text x={x + barW / 2} y={height - 10} textAnchor="middle" fontSize="10" fill="#94a3b8">
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function DonutChart({ data = [], size = 190, thickness = 26, centerLabel, centerValue }) {
  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Donut chart">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#eef1f6" strokeWidth={thickness} />
          {total > 0 &&
            data.map((item, index) => {
              const value = Number(item.value) || 0;
              const length = (value / total) * circumference;
              const circle = (
                <circle
                  key={`${item.label}-${index}`}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={item.color || palette[index % palette.length]}
                  strokeWidth={thickness}
                  strokeDasharray={`${Math.max(length - 2, 0)} ${circumference}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                >
                  <title>{`${item.label}: ${value}`}</title>
                </circle>
              );
              offset += length;
              return circle;
            })}
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeContent: "center",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 750, letterSpacing: "-0.03em" }}>
            {centerValue ?? total}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
            {centerLabel || "Total"}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gap: 8, flex: 1, minWidth: 130 }}>
        {data.map((item, index) => (
          <div key={`${item.label}-${index}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <i
              style={{
                width: 9,
                height: 9,
                borderRadius: 3,
                background: item.color || palette[index % palette.length],
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span style={{ color: "var(--text-2)", flex: 1 }}>{item.label}</span>
            <strong style={{ fontVariantNumeric: "tabular-nums" }}>{item.value}</strong>
            {total > 0 ? (
              <span style={{ color: "var(--muted)", fontSize: 11, width: 38, textAlign: "right" }}>
                {Math.round(((Number(item.value) || 0) / total) * 100)}%
              </span>
            ) : null}
          </div>
        ))}
        {!data.length ? <span style={{ color: "var(--muted)", fontSize: 12 }}>No data yet.</span> : null}
      </div>
    </div>
  );
}

export { palette };
