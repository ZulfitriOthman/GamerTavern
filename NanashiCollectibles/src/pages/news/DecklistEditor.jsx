import { useEffect, useState } from "react";
import { DECK_GAMES } from "./constants";

export default function DecklistEditor({ open, initial, onClose, onSave, saving, error }) {
  const isEdit = Boolean(initial?.dbId);
  const [name, setName] = useState("");
  const [game, setGame] = useState("Magic");
  const [archetype, setArchetype] = useState("");
  const [format, setFormat] = useState("");
  const [pilot, setPilot] = useState("");
  const [description, setDescription] = useState("");
  const [keyCards, setKeyCards] = useState("");
  const [winRate, setWinRate] = useState("");
  const [popularity, setPopularity] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [featured, setFeatured] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name || "");
    setGame(initial?.game || "Magic");
    setArchetype(initial?.archetype || "");
    setFormat(initial?.format || "");
    setPilot(initial?.pilot || "");
    setDescription(initial?.description || "");
    setKeyCards(
      Array.isArray(initial?.keyCards) ? initial.keyCards.join(", ") : "",
    );
    setWinRate(initial?.winRate != null ? String(initial.winRate) : "");
    setPopularity(initial?.popularity != null ? String(initial.popularity) : "");
    setAvgCost(initial?.avgCost != null ? String(initial.avgCost) : "");
    setFeatured(Boolean(initial?.featured));
  }, [open, initial]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim() || !game) return;
    onSave({
      id: initial?.dbId,
      name: name.trim(),
      game,
      archetype: archetype.trim(),
      format: format.trim(),
      pilot: pilot.trim(),
      description: description.trim(),
      keyCards: keyCards.trim(),
      winRate: winRate.trim(),
      popularity: popularity.trim(),
      avgCost: avgCost.trim(),
      featured,
    });
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <form
        onSubmit={submit}
        className="relative mx-auto mt-10 max-h-[88vh] w-[92%] max-w-2xl space-y-4 overflow-y-auto rounded-2xl border border-amber-900/40 bg-gradient-to-b from-slate-950 via-purple-950/30 to-slate-950 p-6 shadow-2xl shadow-purple-900/30"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl font-bold text-amber-100">
            {isEdit ? "Edit Decklist" : "New Decklist"}
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

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Deck Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Game
            </label>
            <select
              value={game}
              onChange={(e) => setGame(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            >
              {DECK_GAMES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Archetype
            </label>
            <input
              value={archetype}
              onChange={(e) => setArchetype(e.target.value)}
              placeholder="Aggro / Combo / Control…"
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Format
            </label>
            <input
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              placeholder="Standard / Pioneer / Advanced…"
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Pilot
            </label>
            <input
              value={pilot}
              onChange={(e) => setPilot(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
            Key Cards (comma separated)
          </label>
          <input
            value={keyCards}
            onChange={(e) => setKeyCards(e.target.value)}
            placeholder="Sol Ring, Lightning Bolt, …"
            className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Win Rate (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={winRate}
              onChange={(e) => setWinRate(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Popularity
            </label>
            <input
              type="number"
              min="0"
              value={popularity}
              onChange={(e) => setPopularity(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Avg Cost (BND)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm font-serif text-amber-100/80">
          <input
            type="checkbox"
            checked={featured}
            onChange={(e) => setFeatured(e.target.checked)}
            className="h-4 w-4 rounded border-amber-700/40 bg-slate-900 accent-amber-500"
          />
          Mark as ★ Spotlight (featured deck)
        </label>

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
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Decklist"}
          </button>
        </div>
      </form>
    </div>
  );
}
