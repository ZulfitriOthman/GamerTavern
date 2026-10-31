import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import Section from "../../components/layout/Section.jsx";
import SectionHeading from "../../components/ui/SectionHeading.jsx";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import BlurFade from "../../components/ui/BlurFade.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { SkeletonText } from "../../components/ui/Skeleton.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { useTournaments } from "../../features/tournament/useTournaments.js";
import { formatDate, formatEntryFee } from "../../features/tournament/format.js";

// draft/open/closed/completed/cancelled — see Database/schema/007_content_community.sql
// TOURNAMENTS.STATUS. "Coming Soon" is this section's own label for `draft`
// (a real tournament row the organizer hasn't opened registration on yet),
// never a fabricated placeholder event.
const STATUS_LABEL = {
  open: "Registration Open",
  draft: "Coming Soon",
  closed: "Registration Closed",
  completed: "Completed",
  cancelled: "Cancelled",
};
const STATUS_TONE = { open: "signal", draft: "gold", closed: "neutral", completed: "neutral", cancelled: "danger" };

function TournamentStatusBadge({ status }) {
  return <Badge tone={STATUS_TONE[status] || "neutral"}>{STATUS_LABEL[status] || status}</Badge>;
}

// Three-column composition: a featured registration-ready tournament, a
// compact list of the next few upcoming ones, and a static (honest, not
// data-driven) RVS community card that's always present regardless of
// whether any tournament data exists right now.
export default function RvsSection() {
  const { status, tournaments, socketStatus, error } = useTournaments();
  const isLoading = socketStatus === "connecting" || (socketStatus === "connected" && status === "loading");
  const hasError = socketStatus === "error" || status === "error";

  useEffect(() => {
    if (hasError) {
      console.error("Tournament feed unavailable:", error || "socket connection error");
    }
  }, [hasError, error]);

  const { featured, upcoming } = useMemo(() => {
    const relevant = tournaments
      .filter((t) => t.status === "open" || t.status === "draft")
      .sort((a, b) => (a.status === b.status ? 0 : a.status === "open" ? -1 : 1));
    return { featured: relevant[0] || null, upcoming: relevant.slice(1, 4) };
  }, [tournaments]);

  return (
    <Section tone="muted" spacing="md" containerSize="xwide">
      <BlurFade inView>
        <SectionHeading
          size="section"
          eyebrow="RVS Esports"
          title="Tournament registration, run for real"
          description="RVS Esports runs live tournament registration on the NanashiCollectibles platform — starting with Apex Legends, built to support more games over time."
        />
      </BlurFade>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_1fr_0.85fr]">
        {/* Featured tournament / empty state */}
        {isLoading ? (
          <Card variant="elevated" className="flex flex-col gap-4">
            <SkeletonText lines={4} />
          </Card>
        ) : hasError || !featured ? (
          <Card variant="elevated" className="flex flex-col justify-between gap-4">
            <EmptyState
              title={hasError ? "Tournament feed is temporarily unavailable" : "No tournaments are open right now"}
              description={
                hasError
                  ? "Visit RVS Esports directly for the latest announcements."
                  : "New RVS Esports tournaments are announced here as soon as registration opens."
              }
            />
            <Button to="/esports" variant="secondary" size="md" className="w-fit">
              View RVS Esports →
            </Button>
          </Card>
        ) : (
          <Card
            as={Link}
            to={`/esports/tournaments/${featured.id}`}
            variant="interactive"
            className="flex flex-col gap-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-50/45">Featured</p>
                <h3 className="mt-1 font-display text-xl font-semibold text-amber-50">{featured.name}</h3>
              </div>
              <TournamentStatusBadge status={featured.status} />
            </div>

            {featured.description ? (
              <p className="line-clamp-2 text-sm text-amber-50/65">{featured.description}</p>
            ) : null}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {featured.esports_game_name ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-amber-50/40">Game</dt>
                  <dd className="mt-0.5 text-amber-50/80">{featured.esports_game_name}</dd>
                </div>
              ) : null}
              {formatDate(featured.start_date) ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-amber-50/40">Starts</dt>
                  <dd className="mt-0.5 text-amber-50/80">{formatDate(featured.start_date)}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs uppercase tracking-wide text-amber-50/40">Entry</dt>
                <dd className="mt-0.5 text-amber-50/80">{formatEntryFee(featured.entry_fee)}</dd>
              </div>
              {featured.location ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-amber-50/40">Location</dt>
                  <dd className="mt-0.5 truncate text-amber-50/80">{featured.location}</dd>
                </div>
              ) : null}
            </dl>

            <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-brand-300">
              {featured.status === "open" ? "Register now" : "View details"}
              <span aria-hidden="true">→</span>
            </span>
          </Card>
        )}

        {/* Upcoming list */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-50/45">Upcoming</p>
          {isLoading ? (
            <Card className="flex-1">
              <SkeletonText lines={5} />
            </Card>
          ) : upcoming.length === 0 ? (
            <Card className="flex flex-1 items-center">
              <p className="text-sm text-amber-50/50">
                No other tournaments are scheduled yet — check back as RVS Esports announces more events.
              </p>
            </Card>
          ) : (
            <div className="flex flex-1 flex-col gap-2.5">
              {upcoming.map((t) => (
                <Card
                  key={t.id}
                  as={Link}
                  to={`/esports/tournaments/${t.id}`}
                  variant="interactive"
                  className="flex items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-amber-50/90">{t.name}</p>
                    <p className="mt-0.5 text-xs text-amber-50/50">
                      {t.esports_game_name || "RVS Esports"}
                      {formatDate(t.start_date) ? ` · ${formatDate(t.start_date)}` : ""}
                    </p>
                  </div>
                  <TournamentStatusBadge status={t.status} />
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* RVS community info — static, honest, always present */}
        <Card variant="elevated" className="flex flex-col gap-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-brand-300">
            <Icon name="users" className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-display text-base font-semibold text-amber-50">RVS Esports</h3>
            <p className="mt-2 text-sm text-amber-50/65">
              Registration, brackets, and results all run through the platform — no third-party sign-up sheets or
              spreadsheets.
            </p>
          </div>
          <ul className="flex flex-col gap-2 text-sm text-amber-50/70">
            {["In-platform registration", "Individual & team formats", "Live status updates"].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-signal-400" />
                {item}
              </li>
            ))}
          </ul>
          <Button to="/esports" variant="secondary" size="sm" className="mt-auto w-fit">
            About RVS Esports
          </Button>
        </Card>
      </div>
    </Section>
  );
}
