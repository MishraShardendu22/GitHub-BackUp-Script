import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "accent"
  | "danger"
  | "link";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  block?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: "m-btn--primary",
  secondary: "m-btn--secondary",
  ghost: "m-btn--ghost",
  accent: "m-btn--accent",
  danger: "m-btn--danger",
  link: "m-btn--link",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "m-btn--sm",
  md: "",
  lg: "m-btn--lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      block = false,
      leftIcon,
      rightIcon,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        "m-btn",
        VARIANT[variant],
        SIZE[size],
        block && "m-btn--block",
        className,
      )}
      {...props}
    >
      {isLoading ? <span className="m-spinner" aria-hidden="true" /> : leftIcon}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  ),
);

Button.displayName = "Button";
