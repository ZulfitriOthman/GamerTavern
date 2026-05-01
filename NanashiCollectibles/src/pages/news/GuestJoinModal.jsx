import { useEffect, useState } from "react";
import { formatDate } from "./helpers";

export default function GuestJoinModal({ open, tournament, onClose, onSubmit, saving, error }) {
  const [name, setName] = useState("");
  const [teamName, setTeamName] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setTeamName("");
  }, [open]);

  if (!open || !tournament) return null;

  const submit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({
      guestName: trimmed.slice(0, 100),
      teamName: teamName.trim().slice(0, 255),
    });
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={saving ? undefined : onClose}
      />
      <form
        onSubmit={submit}
        className="relative mx-auto mt-16 w-[92%] max-w-md space-y-4 overflow-hidden rounded-2xl border border-amber-900/40 bg-gradient-to-b from-slate-950 via-purple-950/30 to-slate-950 p-6 shadow-2xl shadow-purple-900/30"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-serif text-[10px] uppercase tracking-[0.3em] text-amber-300/70">
              ❖ Join as Guest
            </p>
            <h3 className="mt-1 font-serif text-xl font-bold text-amber-100">
              {tournament.title}
            </h3>
            <p className="mt-1 text-xs italic text-amber-100/60">
              {formatDate(tournament.date)} · {tournament.startTime}–{tournament.endTime}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full border border-amber-700/40 bg-slate-950/60 px-3 py-1 text-xs font-serif text-amber-200 hover:bg-slate-950/80 disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <div className="rounded-xl border border-amber-800/30 bg-slate-950/40 p-3 text-[11px] text-amber-200/80">
          Joining without an account — your name will be visible to everyone on
          the participant list. Sign in if you want to manage your registration
          later.
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-2 text-sm text-red-200">
            ⚠️ {error}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
            Display Name <span className="text-red-300">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            autoFocus
            placeholder="e.g. Sir Lancelot"
            className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
            Team Name (optional)
          </label>
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            maxLength={255}
            placeholder="e.g. Tavern Knights"
            className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-amber-900/30 bg-slate-950/40 px-4 py-2 font-serif text-sm text-amber-100/80 hover:bg-slate-950/60 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-xl border border-amber-600/50 bg-gradient-to-r from-amber-950/60 to-purple-950/60 px-5 py-2 font-serif text-sm font-bold text-amber-100 shadow-lg shadow-amber-900/20 hover:border-amber-500/80 disabled:opacity-50"
          >
            {saving ? "Joining…" : "Join Tournament"}
          </button>
        </div>
      </form>
    </div>
  );
}
