import { Pill } from "./Pill";
import { formatDate } from "./helpers";

export default function ArticleModal({ open, onClose, article }) {
  if (!open || !article) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative mx-auto mt-10 w-[92%] max-w-3xl overflow-hidden rounded-2xl border border-amber-900/40 bg-gradient-to-b from-slate-950 via-purple-950/30 to-slate-950 shadow-2xl shadow-purple-900/30">
        <div className="relative">
          <img
            src={article.image}
            alt={article.title}
            className="h-56 w-full object-cover opacity-85"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent" />
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full border border-amber-700/40 bg-slate-950/60 px-3 py-1 text-xs font-serif text-amber-200 hover:bg-slate-950/80"
          >
            Close
          </button>
          <div className="absolute bottom-4 left-5 right-5">
            <div className="flex flex-wrap gap-2">
              <Pill>{article.category}</Pill>
              <Pill>{formatDate(article.date)}</Pill>
              <Pill>{article.readTime}</Pill>
            </div>
            <h2 className="mt-3 font-serif text-2xl font-bold text-amber-100">
              {article.title}
            </h2>
            <p className="mt-2 text-sm text-amber-100/80">{article.excerpt}</p>
          </div>
        </div>

        <div className="space-y-4 px-6 py-6 text-amber-50/90">
          <p className="text-xs font-serif tracking-wide text-amber-300/80">
            Source: {article.source}
          </p>

          <div className="space-y-3 leading-relaxed">
            {article.content.map((p, idx) => (
              <p key={idx} className="text-sm text-amber-50/90">
                {p}
              </p>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-amber-800/30 bg-slate-950/40 p-4">
            <p className="text-xs text-amber-200/80">
              Tip: Later, you can replace this modal content with real articles
              fetched from your backend/API.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
