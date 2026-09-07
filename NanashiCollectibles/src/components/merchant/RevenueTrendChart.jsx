import { useEffect, useRef, useState } from "react";
import EmptyState from "../ui/EmptyState.jsx";

// Uses lightweight-charts (already an existing dependency — see package.json — never
// used anywhere yet) rather than adding a new charting library. Renders only real
// GET /api/merchant/dashboard revenueTrend data; if the backend hasn't returned at
// least two points, this shows an empty state instead of a fabricated chart.
export default function RevenueTrendChart({ data }) {
  const containerRef = useRef(null);
  const [renderError, setRenderError] = useState(false);

  const points = (data || [])
    .map((row) => ({ time: String(row.day).slice(0, 10), value: Number(row.total) }))
    .filter((p) => p.time && Number.isFinite(p.value));

  useEffect(() => {
    if (!containerRef.current || points.length < 2) return undefined;

    let chart;
    let cleanupResize;
    (async () => {
      try {
        const { createChart, AreaSeries, ColorType } = await import("lightweight-charts");
        chart = createChart(containerRef.current, {
          layout: {
            background: { type: ColorType.Solid, color: "transparent" },
            textColor: "rgba(255,255,255,0.5)",
            fontFamily: "Inter, system-ui, sans-serif",
          },
          grid: {
            vertLines: { visible: false },
            horzLines: { color: "rgba(255,255,255,0.06)" },
          },
          rightPriceScale: { borderVisible: false },
          timeScale: { borderVisible: false },
          height: 240,
          width: containerRef.current.clientWidth,
        });

        const series = chart.addSeries(AreaSeries, {
          lineColor: "#6c56e8",
          topColor: "rgba(108,86,232,0.35)",
          bottomColor: "rgba(108,86,232,0.02)",
          lineWidth: 2,
        });
        series.setData(points);
        chart.timeScale().fitContent();

        const handleResize = () => chart?.applyOptions({ width: containerRef.current?.clientWidth || 0 });
        window.addEventListener("resize", handleResize);
        cleanupResize = () => window.removeEventListener("resize", handleResize);
      } catch (err) {
        console.error("[RevenueTrendChart] failed to render chart:", err);
        setRenderError(true);
      }
    })();

    return () => {
      cleanupResize?.();
      chart?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)]);

  if (points.length < 2) {
    return <EmptyState title="Not enough data yet" description="Revenue trend appears once you have sales across more than one day." />;
  }

  if (renderError) {
    return <EmptyState title="Chart failed to render" description="Revenue data is available, but the chart couldn't be drawn." />;
  }

  return <div ref={containerRef} className="w-full" />;
}
