import { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
}

export default function Button({ variant = "primary", className, ...rest }: ButtonProps) {
  const variantClass = variant === "primary" ? styles.primary : variant === "danger" ? styles.danger : styles.secondary;
  return <button className={[styles.button, variantClass, className].filter(Boolean).join(" ")} {...rest} />;
}
