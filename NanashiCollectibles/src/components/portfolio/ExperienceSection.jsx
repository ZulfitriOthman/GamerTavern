import { educationTimeline, experienceTimeline } from "../../data/portfolioContent.js";

function WorkTimeline() {
  return (
    <ol className="flex flex-col gap-6">
      {experienceTimeline.map((entry) => (
        <li key={`${entry.org}-${entry.period}`} className="relative flex gap-4 pl-1">
          <div className="flex flex-col items-center">
            <span
              className={[
                "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                entry.kind === "origin" ? "bg-amber-50/25" : "bg-brand-400",
              ].join(" ")}
            />
            <span className="mt-1 w-px flex-1 bg-white/10" aria-hidden="true" />
          </div>
          <div className="pb-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-50/40">{entry.period}</p>
            <h4 className={["mt-1 font-display text-base font-semibold", entry.kind === "origin" ? "text-amber-50/70" : "text-amber-50"].join(" ")}>
              {entry.role} · {entry.org}
            </h4>
            <p className="mt-1.5 text-sm leading-relaxed text-amber-50/60">{entry.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function EducationList() {
  return (
    <ul className="flex flex-col gap-3">
      {educationTimeline.map((entry) => (
        <li key={entry.credential} className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-ink-800/40 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-amber-50">{entry.credential}</p>
            {entry.institution ? <p className="text-xs text-amber-50/50">{entry.institution}</p> : null}
          </div>
          <span className="shrink-0 text-xs font-semibold text-amber-50/40">{entry.period}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ExperienceSection() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <h3 className="font-display text-base font-semibold text-amber-50">Journey</h3>
        <div className="mt-5">
          <WorkTimeline />
        </div>
      </div>
      <div>
        <h3 className="font-display text-base font-semibold text-amber-50">Education</h3>
        <div className="mt-5">
          <EducationList />
        </div>
      </div>
    </div>
  );
}
