import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import type { SVGProps } from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type IconProps = Omit<SVGProps<SVGSVGElement>, "className"> & {
  icon: string;
  className?: ClassValue;
};

export function Icon({ icon, className, ...props }: IconProps) {
  return (
    <svg {...props} className={cn(className)} aria-hidden>
      <use href={icon} />
    </svg>
  );
}
