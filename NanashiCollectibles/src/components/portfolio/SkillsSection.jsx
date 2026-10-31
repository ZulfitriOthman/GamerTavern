import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";
import Icon from "../ui/Icon.jsx";
import { otherAreas, skillGroups } from "../../data/portfolioContent.js";

export default function SkillsSection() {
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        {skillGroups.map((group) => (
          <Card key={group.key} className="flex flex-col gap-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-brand-300">
              <Icon name={group.icon} className="h-5 w-5" />
            </span>
            <h3 className="font-display text-base font-semibold text-amber-50">{group.label}</h3>
            <ul className="flex flex-col gap-2 text-sm text-amber-50/70">
              {group.items.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-white/10 p-5">
        <div className="flex items-center gap-2.5">
          <Icon name={otherAreas.icon} className="h-4 w-4 text-amber-50/45" />
          <h3 className="text-sm font-semibold text-amber-50/85">{otherAreas.label}</h3>
        </div>
        <p className="mt-2 text-xs text-amber-50/50">{otherAreas.caption}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {otherAreas.items.map((item) => (
            <Badge key={item} className="text-xs">
              {item}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
