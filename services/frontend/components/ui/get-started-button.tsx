import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

export function GetStartedButton({ onClick }: { onClick?: () => void }) {
  return (
    <Button 
      onClick={onClick} 
      className="group relative overflow-hidden bg-white/5 border border-white/10 text-white hover:bg-white/10 backdrop-blur-md rounded-full h-12 px-6 transition-all" 
      size="lg"
    >
      <span className="mr-8 text-sm font-medium transition-opacity duration-500 group-hover:opacity-0">
        Проанализировать
      </span>
      <i className="absolute right-1 top-1 bottom-1 rounded-full z-10 grid w-10 place-items-center transition-all duration-500 bg-white/10 group-hover:bg-white/20 group-hover:w-[calc(100%-0.5rem)] text-white">
        <ChevronRight size={18} strokeWidth={2.5} aria-hidden="true" />
      </i>
    </Button>
  );
}
