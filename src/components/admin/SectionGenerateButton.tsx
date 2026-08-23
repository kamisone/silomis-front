"use client";

import { Sparkles, Loader2 } from "lucide-react";
import styles from "./SectionGenerateButton.module.css";

interface Props {
  onClick: () => void;
  generating: boolean;
  disabled?: boolean;
  label?: string;
  title?: string;
}

/** Consistent "AI generate" pill used across the product-edit page — one per
 *  section, triggering a translation of the admin-written English source
 *  into the shop's other 6 display languages. */
export default function SectionGenerateButton({ onClick, generating, disabled = false, label = "Generate", title }: Props) {
  return (
    <button
      type="button"
      className={styles.btn}
      onClick={onClick}
      disabled={generating || disabled}
      title={title ?? (disabled ? "Write the English version first" : "Generate the other languages from English")}
    >
      {generating ? <Loader2 size={13} className={styles.spin} /> : <Sparkles size={13} />}
      {generating ? "Generating…" : label}
    </button>
  );
}
