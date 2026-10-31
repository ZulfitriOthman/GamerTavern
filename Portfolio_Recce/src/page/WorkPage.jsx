import { useEffect, useRef, useState } from "react";

function PlayIcon({ className = "" }) {
  return (
    <svg className={`fill-current ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function WorkPage({ featuredFilm, highlights }) {
  const [activeClip, setActiveClip] = useState(null);
  const featuredVideoRef = useRef(null);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const lastTriggerRef = useRef(null);

  // The featured film is drawn from the same highlight data, so leave it out of
  // the grid while it's featured instead of showing (and loading) it twice.
  const reels = featuredFilm
    ? highlights.filter((clip) => clip.src !== featuredFilm.src)
    : highlights;
  // Only the page's top heading should be an h1.
  const ReelsHeading = featuredFilm ? "h2" : "h1";

  const openClip = (clip, event) => {
    lastTriggerRef.current = event?.currentTarget ?? null;
    featuredVideoRef.current?.pause();
    setActiveClip(clip);
  };

  const closeClip = () => {
    setActiveClip(null);
    lastTriggerRef.current?.focus();
  };

  useEffect(() => {
    if (!activeClip) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        closeClip();
        return;
      }

      // Keep Tab focus inside the dialog while it's open.
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll("video, button");
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        } else if (!dialogRef.current.contains(document.activeElement)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClip]);

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 md:px-10 md:pb-24 md:pt-28">
        {featuredFilm && (
          <section aria-labelledby="featured-film-title" className="reveal relative">
            {/* Soft light spill behind the player — kept faint so the footage leads. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-[8%] top-16 -z-10 h-2/3 rounded-full bg-skyaccent/10 blur-[100px]"
            />

            <div className="mb-4 flex items-center gap-4 md:mb-5">
              <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-skyaccent">
                <span aria-hidden="true" className="h-px w-8 bg-skyaccent/70" />
                Featured Film
              </p>
              <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
              {featuredFilm.location && (
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  {featuredFilm.location}
                </p>
              )}
            </div>

            <div className="overflow-hidden rounded-xl bg-black shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/10 md:rounded-2xl">
              <video
                ref={featuredVideoRef}
                className="block aspect-video w-full bg-black object-contain"
                src={featuredFilm.src}
                poster={featuredFilm.poster}
                controls
                playsInline
                preload="metadata"
                aria-labelledby="featured-film-title"
              />
            </div>

            <div className="mt-6 grid gap-3 md:mt-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-end lg:gap-12">
              <h1
                id="featured-film-title"
                className="font-display text-4xl leading-[0.92] tracking-wide text-slate-50 sm:text-5xl lg:text-6xl"
              >
                {featuredFilm.title}
              </h1>
              <p className="max-w-xl text-[15px] leading-relaxed text-slate-300 lg:pb-1">
                {featuredFilm.description}
              </p>
            </div>
          </section>
        )}

        {reels.length > 0 && (
          <section
            aria-labelledby="highlight-reels-title"
            className={featuredFilm ? "mt-16 border-t border-white/10 pt-12 md:mt-20 md:pt-16" : ""}
          >
            <div className="reveal mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <p className="mb-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-skyaccent">
                  <span aria-hidden="true" className="h-px w-8 bg-skyaccent/70" />
                  Highlight Reels
                </p>
                <ReelsHeading
                  id="highlight-reels-title"
                  className="font-display text-4xl leading-[0.95] tracking-wide sm:text-5xl md:text-6xl"
                >
                  Watch the Footage
                </ReelsHeading>
                <p className="mt-3 text-[15px] leading-relaxed text-slate-400">
                  A selection of aerial passes and hyperlapses from around Brunei. Click a clip to play it in full.
                </p>
              </div>
              <p className="font-display text-2xl tracking-[0.12em] text-slate-500">
                {String(reels.length).padStart(2, "0")} Clips
              </p>
            </div>

            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:gap-6 lg:gap-8">
              {reels.map((clip, index) => {
                // With an odd count, let the last card span the row instead of
                // leaving an empty cell beside it.
                const spanRow = reels.length % 2 === 1 && index === reels.length - 1 && reels.length > 1;
                return (
                  <li
                    key={clip.src}
                    data-delay={(index % 2) * 90}
                    className={`reveal ${spanRow ? "sm:col-span-2" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={(event) => openClip(clip, event)}
                      aria-label={`Play ${clip.caption}, ${clip.location}`}
                      className="group block w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-skyaccent focus-visible:ring-offset-4 focus-visible:ring-offset-[#0c131b] md:rounded-2xl"
                    >
                      <span className="relative block aspect-video overflow-hidden rounded-xl bg-slate-900 shadow-panel ring-1 ring-white/10 transition duration-500 group-hover:ring-skyaccent/40 group-focus-visible:ring-skyaccent/40 md:rounded-2xl">
                        <img
                          src={clip.poster}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover brightness-[0.85] transition duration-700 ease-out group-hover:scale-[1.04] group-hover:brightness-100 group-focus-visible:scale-[1.04] group-focus-visible:brightness-100 motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-focus-visible:scale-100"
                        />
                        <span
                          aria-hidden="true"
                          className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"
                        />

                        <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-200 ring-1 ring-white/15 md:left-4 md:top-4">
                          {clip.location}
                        </span>

                        <span className="absolute bottom-3 left-3 flex items-center gap-3 md:bottom-4 md:left-4">
                          <span className="grid h-12 w-12 place-content-center rounded-full bg-white/10 text-white ring-1 ring-white/40 backdrop-blur-sm transition duration-300 group-hover:scale-110 group-hover:bg-skyaccent group-hover:text-slate-950 group-hover:ring-skyaccent group-focus-visible:bg-skyaccent group-focus-visible:text-slate-950 motion-reduce:transition-none motion-reduce:group-hover:scale-100 md:h-14 md:w-14">
                            <PlayIcon className="ml-0.5 h-5 w-5 md:h-6 md:w-6" />
                          </span>
                          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/0 transition duration-300 group-hover:text-white/90 group-focus-visible:text-white/90">
                            Play
                          </span>
                        </span>
                      </span>

                      <span className="mt-4 flex gap-4 px-1">
                        <span
                          aria-hidden="true"
                          className="pt-1 font-display text-lg tracking-[0.12em] text-skyaccent/80"
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 space-y-1.5">
                          <span className="block font-display text-2xl leading-tight tracking-wide text-slate-100 transition-colors duration-300 group-hover:text-white md:text-[1.75rem]">
                            {clip.caption}
                          </span>
                          <span className="block text-sm leading-relaxed text-slate-400">
                            {clip.description}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      {activeClip && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4 backdrop-blur-sm md:p-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="active-clip-title"
          onClick={closeClip}
        >
          <div
            ref={dialogRef}
            className="w-full max-w-5xl animate-floatIn motion-reduce:animate-none"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="overflow-hidden rounded-xl bg-black ring-1 ring-white/10 md:rounded-2xl">
              <video
                key={activeClip.src}
                className="mx-auto block max-h-[75vh] w-full bg-black object-contain"
                src={activeClip.src}
                poster={activeClip.poster}
                controls
                autoPlay
                playsInline
                preload="none"
              />
            </div>
            <div className="mt-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.2em] text-skyaccent">{activeClip.location}</p>
                <p id="active-clip-title" className="mt-1 font-display text-2xl tracking-wide text-slate-100 md:text-3xl">
                  {activeClip.caption}
                </p>
                <p className="mt-1 text-sm text-slate-400">{activeClip.description}</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeClip}
                className="flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm text-white ring-1 ring-white/20 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skyaccent"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default WorkPage;
