import React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-2xl border shadow-craft transition-all duration-300",
  {
    variants: {
      variant: {
        default: "bg-gradient-card border-gray-200/50 hover:shadow-craft-lg",
        glass: "bg-gradient-glass backdrop-blur-md border-white/20",
        gradient: "bg-gradient-primary text-white border-0",
        outline: "bg-white border-gray-200 hover:border-primary-300",
      },
      size: {
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
        xl: "p-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(cardVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);

Card.displayName = "Card";

export { Card, cardVariants };
