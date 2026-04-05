import React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-gradient-primary text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5",
        secondary: "bg-gradient-secondary text-gray-900 shadow-md hover:shadow-lg",
        outline: "border-2 border-primary-500 text-primary-500 hover:bg-primary-50 hover:text-primary-600",
        ghost: "text-primary-500 hover:bg-primary-50 hover:text-primary-600",
        link: "text-primary-500 underline-offset-4 hover:underline",
        glass: "bg-gradient-glass backdrop-blur-sm border border-white/20 text-gray-900 hover:bg-white/10",
      },
      size: {
        sm: "h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm",
        md: "h-10 sm:h-11 px-4 sm:px-6 text-sm sm:text-base",
        lg: "h-12 sm:h-13 px-6 sm:px-8 text-base sm:text-lg",
        xl: "h-14 sm:h-16 px-8 sm:px-10 text-lg sm:text-xl",
        icon: "h-10 w-10 sm:h-11 sm:w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
