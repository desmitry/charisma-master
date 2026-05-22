import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

export function GetStartedButton({ onClick }: { onClick?: () => void }) {
  return (
    <Button 
      onClick={onClick} 
      className="group relative overflow-hidden bg-foreground text-background border border-foreground/15 hover:bg-foreground/88 backdrop-blur-md rounded-full h-12 px-6 shadow-[0_14px_34px_var(--shadow-color)] transition-all" 
      size="lg"
    >
      <span className="mr-8 text-sm font-medium transition-opacity duration-500 group-hover:opacity-0">
        Проанализировать
      </span>
      <i className="absolute right-1 top-1 bottom-1 rounded-full z-10 grid w-10 place-items-center transition-all duration-500 bg-background/12 group-hover:bg-background/18 group-hover:w-[calc(100%-0.5rem)] text-background">
        <ChevronRight size={18} strokeWidth={2.5} aria-hidden="true" />
      </i>
    </Button>
  );
}
