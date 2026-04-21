import logo from "@/assets/logo.jpeg";
import { cn } from "@/lib/utils";

interface Props {
  collapsed?: boolean;
}

export const BrandLogo = ({ collapsed = false }: Props) => {
  return (
    <div className={cn("flex items-center gap-3 transition-all duration-300", collapsed ? "px-0 justify-center" : "px-2")}>
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-primary-hover rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <img 
          src={logo} 
          alt="CM" 
          className={cn(
            "relative rounded-lg object-cover border border-border/50 shadow-sm transition-all duration-300",
            collapsed ? "h-9 w-9" : "h-10 w-10"
          )} 
        />
      </div>
      
      {!collapsed && (
        <div className="leading-tight">
          <div className="font-black text-[16px] tracking-tight text-foreground bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70">
            CREATIVE MARK
          </div>
          <div className="text-[9px] text-muted-foreground font-medium uppercase tracking-[0.1em]">
            Advertising · Branding
          </div>
        </div>
      )}
    </div>
  );
};

