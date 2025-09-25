// Type declarations for UI components
import { ComponentProps, ReactNode } from 'react';

export interface CardProps extends ComponentProps<'div'> {
  children?: ReactNode;
}

export interface CardHeaderProps extends ComponentProps<'div'> {
  children?: ReactNode;
}

export interface CardContentProps extends ComponentProps<'div'> {
  children?: ReactNode;
}

export interface CardTitleProps extends ComponentProps<'h3'> {
  children?: ReactNode;
}

export interface ButtonProps extends ComponentProps<'button'> {
  children?: ReactNode;
  variant?: string;
  size?: string;
}

export interface InputProps extends ComponentProps<'input'> {
}

export interface CollapsibleProps extends ComponentProps<'div'> {
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export interface CollapsibleTriggerProps extends ComponentProps<'div'> {
  children?: ReactNode;
  asChild?: boolean;
}

export interface CollapsibleContentProps extends ComponentProps<'div'> {
  children?: ReactNode;
}

export declare const Card: React.ForwardRefExoticComponent<CardProps>;
export declare const CardHeader: React.ForwardRefExoticComponent<CardHeaderProps>;
export declare const CardContent: React.ForwardRefExoticComponent<CardContentProps>;
export declare const CardTitle: React.ForwardRefExoticComponent<CardTitleProps>;
export declare const Button: React.ForwardRefExoticComponent<ButtonProps>;
export declare const Input: React.ForwardRefExoticComponent<InputProps>;
export declare const Collapsible: React.ForwardRefExoticComponent<CollapsibleProps>;
export declare const CollapsibleTrigger: React.ForwardRefExoticComponent<CollapsibleTriggerProps>;
export declare const CollapsibleContent: React.ForwardRefExoticComponent<CollapsibleContentProps>;