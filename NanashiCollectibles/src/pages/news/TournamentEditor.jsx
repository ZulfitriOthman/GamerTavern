import { useEffect, useRef, useState } from "react";
import { TOURNAMENT_GAMES } from "./constants";

export default function TournamentEditor({ open, initial, onClose, onSave, saving, error }) {
  const isEdit = Boolean(initial?.dbId);
  const [name, setName] = useState("");
  const [game, setGame] = useState("General");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("18:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("21:00");
  const [entryFee, setEntryFee] = useState("");
  const [maxTeams, setMaxTeams] = useState("");
  const [regDeadline, setRegDeadline] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [rules, setRules] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    const raw = initial?._raw || {};
    const startDt = raw.start_date ? new Date(raw.start_date) : null;
    const endDt = raw.end_date ? new Date(raw.end_date) : null;
    const regDt = raw.registration_deadline
      ? new Date(raw.registration_deadline)
      : null;
    const pad = (n) => String(n).padStart(2, "0");
    const toDateStr = (d) =>
      d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "";
    const toTimeStr = (d) =>
      d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "";

    setName(initial?.title || raw.name || "");
    setGame(initial?.game || raw.game_title || "General");
    setLocation(initial?.location || raw.location || "");
    setStartDate(toDateStr(startDt) || initial?.date || "");
    setStartTime(toTimeStr(startDt) || initial?.startTime || "18:00");
    setEndDate(toDateStr(endDt) || initial?.date || "");
    setEndTime(toTimeStr(endDt) || initial?.endTime || "21:00");
    setEntryFee(raw.entry_fee != null ? String(raw.entry_fee) : "");
    setMaxTeams(raw.max_teams != null ? String(raw.max_teams) : "");
    setRegDeadline(regDt ? toDateStr(regDt) : "");
    setOrganizer(raw.organizer || "");
    setRules(raw.rules || initial?.format || "");
    setDescription(raw.description || initial?.notes || "");
  }, [open, initial]);

  // Lock body scroll + scroll modal to top when opened
  const formRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      formRef.current?.scrollTo?.({ top: 0 });
    });
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim() || !startDate) return;

    const buildIso = (d, t) => (d ? `${d}T${t || "00:00"}:00` : "");

    onSave({
      id: initial?.dbId,
      name: name.trim(),
      gameTitle: game,
      location: location.trim(),
      startDate: buildIso(startDate, startTime),
      endDate: endDate ? buildIso(endDate, endTime) : "",
      entryFee: entryFee.trim(),
      maxTeams: maxTeams.trim(),
      registrationDeadline: regDeadline ? `${regDeadline}T23:59:00` : "",
      organizer: organizer.trim(),
      rules: rules.trim(),
      description: description.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <form
        ref={formRef}
        onSubmit={submit}
        className="relative mx-auto mt-10 max-h-[88vh] w-[92%] max-w-2xl space-y-4 overflow-y-auto rounded-2xl border border-amber-900/40 bg-gradient-to-b from-slate-950 via-purple-950/30 to-slate-950 p-6 shadow-2xl shadow-purple-900/30"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl font-bold text-amber-100">
            {isEdit ? "Edit Tournament" : "New Tournament"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-amber-700/40 bg-slate-950/60 px-3 py-1 text-xs font-serif text-amber-200 hover:bg-slate-950/80"
          >
            Close
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-2 text-sm text-red-200">
            ⚠️ {error}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Game
            </label>
            <select
              value={game}
              onChange={(e) => setGame(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            >
              {TOURNAMENT_GAMES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Location
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Start Time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              End Time
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Entry Fee (BND)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={entryFee}
              onChange={(e) => setEntryFee(e.target.value)}
              placeholder="0 = Free"
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Max Teams
            </label>
            <input
              type="number"
              min="0"
              value={maxTeams}
              onChange={(e) => setMaxTeams(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Reg. Deadline
            </label>
            <input
              type="date"
              value={regDeadline}
              onChange={(e) => setRegDeadline(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
            Organizer
          </label>
          <input
            value={organizer}
            onChange={(e) => setOrganizer(e.target.value)}
            placeholder="Defaults to your admin name"
            className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
            Format / Rules
          </label>
          <textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
            Description / Notes
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-amber-900/30 bg-slate-950/40 px-4 py-2 font-serif text-sm text-amber-100/80 hover:bg-slate-950/60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl border border-amber-600/50 bg-gradient-to-r from-amber-950/60 to-purple-950/60 px-5 py-2 font-serif text-sm font-bold text-amber-100 shadow-lg shadow-amber-900/20 hover:border-amber-500/80 disabled:opacity-50"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Tournament"}
          </button>
        </div>
      </form>
    </div>
  );
}
