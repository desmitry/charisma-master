
import { cn } from "@/lib/utils";

export function StatBadge({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "hidden rounded-full px-3 py-1.5 text-xs sm:block",
        accent ? "bg-surface-hover font-medium" : "bg-surface"
      )}
    >
      <span className="text-foreground/50">{label}:</span>{" "}
      <span className="font-semibold">{value}</span>
    </div>
  );
}
