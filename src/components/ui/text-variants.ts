import { cva, type VariantProps } from 'class-variance-authority';

export const textVariants = cva('text-foreground', {
  variants: {
    variant: {
      default: 'text-base',
      h1: 'text-3xl font-bold',
      h2: 'text-2xl font-bold',
      h3: 'text-xl font-semibold',
      h4: 'text-lg font-semibold',
      p: 'text-base',
      lead: 'text-lg text-muted-foreground',
      large: 'text-lg font-semibold',
      small: 'text-sm',
      muted: 'text-sm text-muted-foreground',
      code: 'text-sm font-mono',
      blockquote: 'text-base italic border-l-2 border-border pl-4',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export type TextVariantProps = VariantProps<typeof textVariants>;
