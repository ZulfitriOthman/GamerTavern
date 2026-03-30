import { useState } from "react";

function WorkPage({ galleryItems, highlights, onImageOpen }) {
  const [activeVideo, setActiveVideo] = useState(null);

  return (
    <>
    <section className="px-4 pb-14 pt-28 md:px-10 md:pb-20 md:pt-32">
      <div className="mb-7 reveal">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-skyaccent md:text-sm">
          Featured Work
        </p>
        <h2 className="font-display text-4xl tracking-wide md:text-6xl">Recent Missions</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {galleryItems.map((item, index) => (
          <figure
            key={item.src}
            data-delay={index * 100}
            className="reveal overflow-hidden rounded-2xl border border-white/15 bg-slate-900 shadow-panel"
          >
            <button
              type="button"
              className="group block w-full"
              onClick={() => onImageOpen(item)}
              aria-label={`Open ${item.caption}`}
            >
              <img
                src={item.src}
                alt={item.alt}
                className="h-64 w-full object-cover transition duration-500 group-hover:scale-105"
              />
            </button>
            <figcaption className="px-4 py-3 text-slate-300">{item.caption}</figcaption>
          </figure>
        ))}
      </div>
    </section>

    <section className="px-4 pb-14 md:px-10 md:pb-20">
      <div className="mb-7 reveal">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-skyaccent md:text-sm">
          Highlight Reels
        </p>
        <h2 className="font-display text-4xl tracking-wide md:text-6xl">Watch the Footage</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {highlights.map((clip, index) => (
          <figure
            key={clip.src}
            data-delay={index * 100}
            className="reveal overflow-hidden rounded-2xl border border-white/15 bg-slate-900 shadow-panel"
          >
            <button
              type="button"
              className="group relative block w-full"
              onClick={() => setActiveVideo(clip)}
              aria-label={`Play ${clip.caption}`}
            >
              <img
                src={clip.thumb}
                alt={clip.caption}
                className="h-64 w-full object-cover transition duration-500 group-hover:scale-105 group-hover:brightness-75"
              />
              <span className="absolute inset-0 grid place-content-center">
                <span className="grid h-14 w-14 place-content-center rounded-full bg-white/20 backdrop-blur transition duration-300 group-hover:bg-white/35">
                  <svg className="ml-1 h-6 w-6 fill-white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </span>
              </span>
            </button>
            <figcaption className="px-4 py-3 text-slate-300">{clip.caption}</figcaption>
          </figure>
        ))}
      </div>
    </section>

    {activeVideo && (
      <div
        className="fixed inset-0 z-50 grid place-content-center bg-black/90 p-4"
        role="dialog"
        aria-modal="true"
        aria-label={`Playing: ${activeVideo.caption}`}
        onClick={() => setActiveVideo(null)}
      >
        <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
          <video
            key={activeVideo.src}
            className="w-full rounded-xl"
            src={activeVideo.src}
            controls
            autoPlay
            playsInline
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-slate-200">{activeVideo.caption}</p>
            <button
              type="button"
              onClick={() => setActiveVideo(null)}
              className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm text-white"
            >
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
