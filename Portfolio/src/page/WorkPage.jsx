function WorkPage({ galleryItems, onImageOpen }) {
  return (
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
  );
}

export default WorkPage;
