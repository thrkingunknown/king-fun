import { cva } from 'class-variance-authority'

/** Shared button contract for high-frequency actions across the application. */
export const buttonVariants = cva(
  'kf-btn',
  {
    variants: {
      variant: {
        default: 'kf-btn-primary',
        primary: 'kf-btn-primary',
        outline: 'kf-btn-outline',
        secondary: 'kf-btn-secondary',
        ghost: 'kf-btn-ghost',
        destructive: 'kf-btn-destructive',
        link: 'kf-btn-link',
      },
      size: {
        default: 'kf-btn-md',
        xs: 'kf-btn-xs',
        sm: 'kf-btn-sm',
        lg: 'kf-btn-lg',
        icon: 'kf-btn-icon',
        'icon-xs': 'kf-btn-icon-xs',
        'icon-sm': 'kf-btn-icon-sm',
        'icon-lg': 'kf-btn-icon-lg',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)
