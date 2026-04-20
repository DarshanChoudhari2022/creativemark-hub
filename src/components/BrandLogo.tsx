import logo from "@/assets/logo.jpeg";

interface Props {
  collapsed?: boolean;
}

export const BrandLogo = ({ collapsed = false }: Props) => {
  if (collapsed) {
    return (
      <div className="flex items-center justify-center h-10 w-10 rounded-md bg-primary text-primary-foreground font-extrabold text-sm">
        CM
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-1">
      <img src={logo} alt="CreativeMark logo" className="h-9 w-9 rounded object-cover" />
      <div className="leading-tight">
        <div className="font-extrabold text-[15px] tracking-tight text-foreground">CREATIVE MARK</div>
        <div className="text-[9px] text-muted-foreground tracking-wide">Advertising · Digital · Branding</div>
      </div>
    </div>
  );
};
