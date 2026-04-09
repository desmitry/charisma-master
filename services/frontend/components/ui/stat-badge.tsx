
import { cn } from "@/lib/utils";

export function StatBadge({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "hidden rounded-full px-3 py-1.5 text-xs sm:block",
        accent ? "bg-white/15 font-medium" : "bg-white/5"
      )}
    >
      <span className="text-white/50">{label}:</span>{" "}
      <span className="font-semibold">{value}</span>
    </div>
  );
}
