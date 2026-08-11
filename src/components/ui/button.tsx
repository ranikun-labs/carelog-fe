import { type VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors outline-none disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-accent-primary text-primary-foreground hover:bg-accent-primary/90',
        primary: 'bg-accent-primary text-primary-foreground hover:bg-accent-primary/90',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        outline: 'border border-border-default bg-surface text-accent-primary-deep hover:bg-subtle',
        secondary:
          'border border-border-default bg-surface text-accent-primary-deep hover:bg-subtle',
        ghost: 'text-accent-primary-deep hover:bg-subtle',
        text: 'text-accent-primary-deep hover:bg-subtle',
        link: 'text-accent-primary-deep underline-offset-4 hover:underline',
      },
      size: {
        default: 'min-h-[46px] rounded-md px-4 py-2 text-[0.9375rem] has-[>svg]:px-3',
        sm: 'min-h-11 rounded-md gap-1.5 px-3 py-1.5 text-body-sm has-[>svg]:px-2.5',
        lg: 'min-h-[54px] rounded-lg px-6 py-2.5 text-[1.0625rem] has-[>svg]:px-4',
        icon: 'size-11 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
