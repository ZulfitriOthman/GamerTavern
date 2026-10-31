import Card from "../ui/Card.jsx";
import Icon from "../ui/Icon.jsx";
import { capabilities } from "../../data/portfolioContent.js";

export default function CapabilitiesSection() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {capabilities.map((item) => (
        <Card key={item.key} className="flex flex-col gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-signal-400">
            <Icon name={item.icon} className="h-5 w-5" />
          </span>
          <h3 className="font-display text-base font-semibold text-amber-50">{item.title}</h3>
          <p className="text-sm leading-relaxed text-amber-50/65">{item.description}</p>
        </Card>
      ))}
    </div>
  );
}
