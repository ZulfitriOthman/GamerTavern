import { Link } from "react-router-dom";
import Card from "../../components/ui/Card.jsx";
import Badge from "../../components/ui/Badge.jsx";
import { formatDate, formatEntryFee } from "./format.js";

export default function TournamentCard({ tournament }) {
  const spotsLeft =
    tournament.max_teams != null ? tournament.max_teams - (tournament.participants?.length || 0) : null;

  return (
    <Card as={Link} to={`/esports/tournaments/${tournament.id}`} className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold text-amber-50">{tournament.name}</h3>
        {tournament.game_title ? <Badge tone="signal">{tournament.game_title}</Badge> : null}
      </div>

      {tournament.description ? (
        <p className="line-clamp-2 text-sm text-amber-50/60">{tournament.description}</p>
      ) : null}

      <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-amber-50/60">
        {formatDate(tournament.start_date) ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-amber-50/30">Starts</dt>
            <dd>{formatDate(tournament.start_date)}</dd>
          </div>
        ) : null}
        {tournament.location ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-amber-50/30">Location</dt>
            <dd>{tournament.location}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs uppercase tracking-wide text-amber-50/30">Entry fee</dt>
          <dd>{formatEntryFee(tournament.entry_fee)}</dd>
        </div>
        {spotsLeft != null ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-amber-50/30">Spots left</dt>
            <dd>{Math.max(spotsLeft, 0)}</dd>
          </div>
        ) : null}
      </dl>
    </Card>
  );
}
