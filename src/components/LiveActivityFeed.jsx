// Live Activity Feed Component - Shows real-time activities
import { useMemo } from "react";
import { useSocket } from "../hooks/useSocket";

function LiveActivityFeed() {
  const { activities, isConnected } = useSocket();

  // Limit to last 10 activities (memoized for performance)
  const visibleActivities = useMemo(() => {
    return (activities || []).slice(0, 10);
  }, [activities]);

  /* -----------------------------------------------------------
     Helpers
     ----------------------------------------------------------- */

  const getActivityIcon = (type) => {
    switch (type) {
      case "product":
        return "📦";
      case "cart":
        return "🛒";
      case "trade":
        return "🔄";
      case "stock":
        return "⚠️";
      case "price":
        return "💰";
      default:
        return "✨";
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";

    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60_000) return "Just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;

    return date.toLocaleDateString();
  };

  /* -----------------------------------------------------------
     Empty state
     ----------------------------------------------------------- */

  if (!visibleActivities.length) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/30 p-4 shadow-lg shadow-purple-900/20">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-sm font-bold text-amber-100">
            🔴 Live Activity
          </h3>

          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
              }`}
            />
            <span className="font-serif text-xs text-amber-100/60">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>

        <p className="py-4 text-center font-serif text-xs italic text-amber-100/50">
          No recent activity. Waiting for updates…
        </p>

        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      </div>
    );
  }

  /* -----------------------------------------------------------
     Main render
     ----------------------------------------------------------- */

  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-900/30 bg-gradient-to-br from-slate-950 to-purple-950/30 p-4 shadow-lg shadow-purple-900/20">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-serif text-sm font-bold text-amber-100">
          🔴 Live Activity
        </h3>

        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
            }`}
          />
          <span className="font-serif text-xs text-amber-100/60">
            {isConnected ? "Live" : "Offline"}
          </span>
        </div>
      </div>

      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {visibleActivities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-2 rounded-lg border border-amber-900/20 bg-slate-950/50 p-2 transition-all hover:border-amber-600/30"
          >
            <span className="text-lg">
              {getActivityIcon(activity.type)}
            </span>

            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 font-serif text-xs text-amber-100/80">
                {activity.message}
              </p>

              <span className="font-serif text-[10px] italic text-amber-100/40">
                {formatTime(activity.timestamp)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
    </div>
  );
}

export default LiveActivityFeed;
