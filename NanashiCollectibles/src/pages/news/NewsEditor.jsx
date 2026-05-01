import { useEffect, useState } from "react";
import { CATEGORIES } from "./constants";

export default function NewsEditor({ open, initial, onClose, onSave, saving, error }) {
  const isEdit = Boolean(initial?.dbId);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [imageUrl, setImageUrl] = useState("");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title || "");
    setCategory(initial?.category || "General");
    setImageUrl(
      initial?.image && !initial.image.startsWith("https://images.unsplash.com")
        ? initial.image
        : "",
    );
    setTags(initial?.tags || "");
    setContent(initial?.rawContent ?? (initial?.content || []).join("\n\n"));
  }, [open, initial]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    onSave({
      id: initial?.dbId,
      title: title.trim(),
      category,
      imageUrl: imageUrl.trim(),
      tags: tags.trim(),
      content: content.trim(),
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
        className="relative mx-auto mt-10 w-[92%] max-w-2xl space-y-4 overflow-hidden rounded-2xl border border-amber-900/40 bg-gradient-to-b from-slate-950 via-purple-950/30 to-slate-950 p-6 shadow-2xl shadow-purple-900/30"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl font-bold text-amber-100">
            {isEdit ? "Edit Article" : "New Article"}
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
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            >
              {CATEGORIES.filter((c) => c !== "All").map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
              Tags (comma separated)
            </label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
            Image URL (optional)
          </label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-xl border border-amber-900/30 bg-slate-900/80 px-4 py-2 font-serif text-sm text-amber-100 focus:border-amber-600/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-serif uppercase tracking-widest text-amber-100/60">
            Content (separate paragraphs with blank lines)
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={8}
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
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Article"}
          </button>
        </div>
      </form>
    </div>
  );
}
