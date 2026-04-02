import { useState } from "react";

function ContactPage() {
  const [profileImageFailed, setProfileImageFailed] = useState(false);
  const profileImage = "/assets/images/profile-izrat.jpg";

  const focusAreas = [
    "FPV Cinematic",
    "Real Estate Media",
    "Inspection Flights",
    "Event Coverage",
    "Aerial Mapping",
    "Post Production",
  ];

  const quickStats = [
    { label: "Primary Base", value: "Brunei" },
    { label: "Response Time", value: "Within 24 Hours" },
    { label: "Mission Style", value: "Creative + Technical" },
  ];

  return (
    <section className="px-4 pb-14 pt-28 md:px-10 md:pb-20 md:pt-32">
      <div className="reveal overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-slate-900/95 via-slate-900 to-slate-800 p-6 shadow-panel md:p-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr] lg:gap-8">
          <div className="rounded-2xl border border-white/15 bg-slate-950/30 p-5 md:p-6">
            <div className="mb-5 flex items-center gap-4">
              {!profileImageFailed ? (
                <img
                  src={profileImage}
                  alt="Portrait of Muhd Izrat"
                  className="h-20 w-20 rounded-2xl border border-white/20 object-cover shadow-lg"
                  onError={() => setProfileImageFailed(true)}
                />
              ) : (
                <div className="grid h-20 w-20 place-content-center rounded-2xl border border-skyaccent/35 bg-skyaccent/15 font-display text-2xl tracking-wide text-skyaccent">
                  MI
                </div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-skyaccent md:text-sm">
                  Pilot Profile
                </p>
                <p className="mt-1 text-sm uppercase tracking-[0.12em] text-warmaccent">
                  Drone Pilot and Aerial Storyteller
                </p>
              </div>
            </div>

            <h2 className="font-display text-4xl tracking-wide md:text-6xl">Muhd Izrat</h2>
            <p className="mt-4 max-w-2xl text-slate-300">
              I help brands, agencies, and property teams capture cinematic visuals and practical aerial data.
              From planning to final delivery, every mission is built for safety, clarity, and impact.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {focusAreas.map((area) => (
                <span
                  key={area}
                  className="rounded-full border border-skyaccent/35 bg-skyaccent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-skyaccent"
                >
                  {area}
                </span>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {quickStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/10 bg-slate-900/70 p-3"
                >
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{stat.label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-slate-950/35 p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-skyaccent">Contact</p>
            <h3 className="mt-1 font-display text-3xl tracking-wide md:text-4xl">
              Let Your Next Project Take Off
            </h3>
            <p className="mt-3 text-slate-300">
              Share your location, timeline, and goal. I will reply with a recommended flight plan and quote.
            </p>

            <div className="mt-5 grid gap-3">
              <a
                href="mailto:muhd.izrat@gmail.com"
                className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 transition hover:border-skyaccent/70 hover:bg-skyaccent/10"
              >
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Email</p>
                <p className="text-slate-100">muhd.izrat@gmail.com</p>
              </a>

              <a
                href="https://wa.me/6738793875"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/5 px-4 py-3 transition hover:border-skyaccent/70 hover:bg-skyaccent/10"
              >
                <span className="grid h-9 w-9 place-content-center rounded-full border border-emerald-300/35 bg-emerald-400/15 text-emerald-300">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M20.52 3.48A11.78 11.78 0 0 0 12.05 0C5.54 0 .25 5.29.25 11.8c0 2.08.54 4.11 1.58 5.9L0 24l6.48-1.7a11.72 11.72 0 0 0 5.57 1.42h.01c6.51 0 11.79-5.3 11.79-11.81 0-3.15-1.23-6.1-3.33-8.43ZM12.06 21.7h-.01a9.74 9.74 0 0 1-4.95-1.35l-.35-.21-3.84 1 1.03-3.74-.23-.38a9.8 9.8 0 0 1-1.5-5.22c0-5.4 4.4-9.8 9.82-9.8 2.62 0 5.08 1.02 6.92 2.88a9.7 9.7 0 0 1 2.88 6.92c0 5.41-4.4 9.8-9.8 9.8Zm5.38-7.35c-.3-.15-1.77-.87-2.05-.97-.27-.1-.47-.15-.66.15-.2.3-.76.97-.93 1.17-.17.2-.34.22-.64.08-.3-.15-1.24-.46-2.37-1.46-.88-.78-1.48-1.75-1.66-2.04-.17-.3-.02-.46.13-.6.14-.14.3-.35.45-.52.16-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.08-.15-.66-1.6-.9-2.2-.24-.57-.48-.5-.66-.51h-.57c-.2 0-.51.08-.78.37-.27.3-1.02 1-1.02 2.44 0 1.43 1.05 2.82 1.2 3.02.14.2 2.05 3.14 4.96 4.4.69.3 1.24.49 1.66.62.7.22 1.34.19 1.84.12.56-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
                  </svg>
                </span>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">WhatsApp</p>
                  <p className="text-slate-100">+673 879 3875</p>
                </div>
              </a>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="https://instagram.com/recdrone.bn"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-sm text-slate-100 transition hover:border-skyaccent hover:text-skyaccent"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
                Instagram @recdrone.bn
              </a>
              <a
                href="https://tiktok.com/@flybyrecce"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-sm text-slate-100 transition hover:border-skyaccent hover:text-skyaccent"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M16.5 3c.3 1.5 1.2 2.8 2.5 3.6.8.5 1.8.8 2.8.8v3.4c-1.4 0-2.8-.3-4-.9v6.2c0 3.6-2.9 6.5-6.5 6.5S4.8 19.7 4.8 16s2.9-6.5 6.5-6.5c.3 0 .7 0 1 .1V13a3 3 0 1 0 2.3 2.9V3h1.9Z" />
                </svg>
                TikTok @flybyrecce
              </a>
            </div>

            <p className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
              Available booking 1 week early notice for Brunei, 2 weeks for international. Let's plan ahead to secure your spot in the schedule!
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ContactPage;
