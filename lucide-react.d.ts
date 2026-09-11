declare module "lucide-react" {
  import * as React from "react";

  export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
    size?: number | string;
    absoluteStrokeWidth?: boolean;
  }

  // Icon components
  export const AlertCircle: React.ComponentType<IconProps>;
  export const ArrowLeft: React.ComponentType<IconProps>;
  export const Bus: React.ComponentType<IconProps>;
  export const Car: React.ComponentType<IconProps>;
  export const CheckCircle2: React.ComponentType<IconProps>;
  export const ChevronRight: React.ComponentType<IconProps>;
  export const ClipboardCheck: React.ComponentType<IconProps>;
  export const FilePlus2: React.ComponentType<IconProps>;
  export const LayoutDashboard: React.ComponentType<IconProps>;
  export const LogOut: React.ComponentType<IconProps>;
  export const Plus: React.ComponentType<IconProps>;
  export const ShieldCheck: React.ComponentType<IconProps>;
  export const Trash2: React.ComponentType<IconProps>;
  export const User: React.ComponentType<IconProps>;
}
