import React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const containerVariants = cva("mx-auto", {
  variants: {
    variant: {
      content: "max-w-7xl px-4 sm:px-6 md:px-8 lg:px-12",
      page: "container px-4 py-8",
      header: "container flex h-14 sm:h-16 md:h-20 lg:h-24 items-center justify-between px-2 sm:px-4 md:px-6 lg:px-8",
      footer: "container px-4 sm:px-6 md:px-8 py-12 sm:py-16 md:py-20",
    },
    maxWidth: {
      sm: "max-w-sm",
      md: "max-w-md",
      lg: "max-w-lg",
      xl: "max-w-xl",
      "2xl": "max-w-7xl",
      full: "max-w-full",
    },
  },
  defaultVariants: {
    variant: "content",
  },
});

export interface ContainerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof containerVariants> {}

const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, variant, maxWidth, ...props }, ref) => {
    const resolvedMaxWidth =
      maxWidth ?? (variant === "page" ? "2xl" : undefined);

    return (
      <div
        ref={ref}
        className={cn(
          containerVariants({ variant, maxWidth: resolvedMaxWidth, className })
        )}
        {...props}
      />
    );
  }
);

Container.displayName = "Container";

export { Container, containerVariants };
