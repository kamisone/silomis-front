"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { Extension, Mark } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import LinkExtension from "@tiptap/extension-link";
import { useEffect } from "react";
import styles from "./RichTextEditor.module.css";

interface Props {
  content: string;
  onChange: (html: string) => void;
}

/**
 * Font size is authored as a plain number and rendered as
 * `calc(<n> * var(--rt-unit, 1px))`.
 *
 * The number is what the editor shows and what the author types — 64 means 64.
 * The multiplier is what lets a page shrink every explicit size at once: the
 * hero sets `--rt-unit` below its stacking breakpoint, so a 64px headline
 * becomes 40px on a 390px phone without the author doing anything. Anywhere
 * that never defines the variable, the fallback of `1px` makes it exactly the
 * number that was typed — including inside this editor, so what you see here
 * is the size you asked for.
 *
 * The `max(12px, …)` floor is there because one linear scale can't serve both
 * ends: the ratio that takes a 64px headline down to something a phone can hold
 * would take a hand-set 13px caption to 7px, which is not text any more.
 */
const SIZE_CALC = /calc\(\s*([\d.]+)\s*\*/;

function parseSize(raw: string | undefined): string | null {
  if (!raw) return null;
  const viaCalc = raw.match(SIZE_CALC);
  if (viaCalc) return viaCalc[1];
  const px = Number.parseFloat(raw);
  return Number.isFinite(px) ? String(px) : null;
}

/** Colour, size, weight, kerning and case — all attributes on TextStyle's
 *  `<span>`. Each renders into `style`; TipTap's mergeAttributes concatenates
 *  them, so one word can carry all five at once. */
const TextStyleExtras = Extension.create({
  name: "textStyleExtras",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          color: {
            default: null,
            parseHTML: (el) => el.style.color?.replace(/["']/g, "") || null,
            renderHTML: (a) => ((a as { color?: string }).color ? { style: `color: ${(a as { color?: string }).color}` } : {}),
          },
          fontSize: {
            default: null,
            parseHTML: (el) => parseSize(el.style.fontSize),
            renderHTML: (a) => {
              const { fontSize } = a as { fontSize?: string };
              return fontSize
                ? { style: `font-size: max(12px, calc(${fontSize} * var(--rt-unit, 1px)))` }
                : {};
            },
          },
          fontWeight: {
            default: null,
            parseHTML: (el) => el.style.fontWeight || null,
            renderHTML: (a) => {
              const { fontWeight } = a as { fontWeight?: string };
              return fontWeight ? { style: `font-weight: ${fontWeight}` } : {};
            },
          },
          letterSpacing: {
            default: null,
            parseHTML: (el) => el.style.letterSpacing || null,
            renderHTML: (a) => {
              const { letterSpacing } = a as { letterSpacing?: string };
              return letterSpacing ? { style: `letter-spacing: ${letterSpacing}` } : {};
            },
          },
          textTransform: {
            default: null,
            parseHTML: (el) => el.style.textTransform || null,
            renderHTML: (a) => {
              const { textTransform } = a as { textTransform?: string };
              return textTransform ? { style: `text-transform: ${textTransform}` } : {};
            },
          },
        },
      },
    ];
  },
});

/** Leading belongs to the block, not to a run of characters — same shape as
 *  TextAlign, which writes to the same `style` on the same node types. */
const BlockTypography = Extension.create({
  name: "blockTypography",
  addGlobalAttributes() {
    return [
      {
        types: ["heading", "paragraph", "listItem", "blockquote"],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el) => el.style.lineHeight || null,
            renderHTML: (a) => {
              const { lineHeight } = a as { lineHeight?: string };
              return lineHeight ? { style: `line-height: ${lineHeight}` } : {};
            },
          },
        },
      },
    ];
  },
});

/** StarterKit has no underline of its own and the standalone package isn't
 *  installed — a mark that renders `<u>` is the whole of it. */
const Underline = Mark.create({
  name: "underline",
  parseHTML: () => [{ tag: "u" }, { style: "text-decoration=underline" }],
  renderHTML: ({ HTMLAttributes }) => ["u", HTMLAttributes, 0],
});

/** Brand tokens, not a colour wheel: the copy has to stay on-palette, and a
 *  stored `var(--color-accent)` follows the brand if it is ever retuned. */
const SWATCHES: { label: string; value: string | null }[] = [
  { label: "Default", value: null },
  { label: "Primary", value: "var(--color-primary)" },
  { label: "Accent", value: "var(--color-accent)" },
  { label: "Secondary", value: "var(--color-secondary)" },
];

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;
const WEIGHTS = ["300", "400", "500", "600", "700", "800", "900"];
const ALIGNMENTS = [
  { label: "⯇", value: "left", title: "Align left" },
  { label: "≡", value: "center", title: "Align centre" },
  { label: "⯈", value: "right", title: "Align right" },
  { label: "☰", value: "justify", title: "Justify" },
];
const TRANSFORMS = [
  { label: "Case", value: "" },
  { label: "UPPER", value: "uppercase" },
  { label: "lower", value: "lowercase" },
  { label: "Title", value: "capitalize" },
  { label: "Normal", value: "none" },
];

function Toolbar({ editor }: { editor: Editor }) {
  const mark = editor.getAttributes("textStyle") as {
    fontSize?: string;
    fontWeight?: string;
    letterSpacing?: string;
    textTransform?: string;
  };
  const block = (editor.getAttributes("heading").lineHeight ??
    editor.getAttributes("paragraph").lineHeight ??
    "") as string;

  const setMark = (attrs: Record<string, string | null>) => editor.chain().focus().setMark("textStyle", attrs).run();

  const tb = (label: string, active: boolean, action: () => void, title: string) => (
    <button
      key={label + title}
      type="button"
      title={title}
      className={`${styles.tbBtn} ${active ? styles.tbBtnActive : ""}`}
      onMouseDown={(e) => {
        e.preventDefault();
        action();
      }}
    >
      {label}
    </button>
  );

  const blockValue = HEADING_LEVELS.find((l) => editor.isActive("heading", { level: l }));

  function setLink() {
    const previous = (editor.getAttributes("link") as { href?: string }).href ?? "";
    const href = window.prompt("Link address — a storefront path like /sale, or a full https:// URL", previous);
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetMark("link").run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setMark("link", { href: href.trim() }).run();
  }

  function setLineHeight(value: string) {
    const chain = editor.chain().focus();
    for (const type of ["heading", "paragraph", "listItem", "blockquote"]) {
      chain.updateAttributes(type, { lineHeight: value || null });
    }
    chain.run();
  }

  return (
    <div className={styles.toolbar}>
      {/* ── Block: what this paragraph *is* ── */}
      <select
        className={styles.tbSelect}
        title="Text style"
        aria-label="Text style"
        value={blockValue ? `h${blockValue}` : "p"}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "p") editor.chain().focus().setParagraph().run();
          else editor.chain().focus().toggleHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
        }}
      >
        <option value="p">Paragraph</option>
        {HEADING_LEVELS.map((l) => (
          <option key={l} value={`h${l}`}>{`Heading ${l}`}</option>
        ))}
      </select>

      {ALIGNMENTS.map((a) =>
        tb(a.label, editor.isActive({ textAlign: a.value }), () => editor.chain().focus().setTextAlign(a.value).run(), a.title),
      )}

      <span className={styles.tbDivider} />
      {tb("•—", editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), "Bullet list")}
      {tb("1—", editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "Numbered list")}
      {tb("❝", editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), "Quote")}
      {tb("—", false, () => editor.chain().focus().setHorizontalRule().run(), "Divider")}

      <span className={styles.tbBreak} />

      {/* ── Type: size, weight, leading, kerning ── */}
      <label className={styles.tbNumField} title="Font size, in pixels">
        <span className={styles.tbNumLabel}>Size</span>
        <input
          type="number"
          className={styles.tbNum}
          min={8}
          max={200}
          step={1}
          placeholder="auto"
          value={mark.fontSize ?? ""}
          onChange={(e) => setMark({ fontSize: e.target.value || null })}
        />
      </label>

      <select
        className={styles.tbSelect}
        title="Font weight"
        aria-label="Font weight"
        value={mark.fontWeight ?? ""}
        onChange={(e) => setMark({ fontWeight: e.target.value || null })}
      >
        <option value="">Weight</option>
        {WEIGHTS.map((w) => (
          <option key={w} value={w}>{w}</option>
        ))}
      </select>

      <label className={styles.tbNumField} title="Line height (leading) — a multiple of the font size, e.g. 1.2">
        <span className={styles.tbNumLabel}>Leading</span>
        <input
          type="number"
          className={styles.tbNum}
          min={0.6}
          max={3}
          step={0.05}
          placeholder="auto"
          value={block}
          onChange={(e) => setLineHeight(e.target.value)}
        />
      </label>

      <label className={styles.tbNumField} title="Letter spacing (kerning), in hundredths of an em — negative tightens">
        <span className={styles.tbNumLabel}>Kerning</span>
        <input
          type="number"
          className={styles.tbNum}
          min={-10}
          max={30}
          step={1}
          placeholder="0"
          value={mark.letterSpacing ? String(Math.round(Number.parseFloat(mark.letterSpacing) * 100)) : ""}
          onChange={(e) => setMark({ letterSpacing: e.target.value ? `${Number(e.target.value) / 100}em` : null })}
        />
      </label>

      <span className={styles.tbBreak} />

      {/* ── Marks ── */}
      {tb("B", editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "Bold")}
      {tb("I", editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "Italic")}
      {tb("U", editor.isActive("underline"), () => editor.chain().focus().toggleMark("underline").run(), "Underline")}
      {tb("S", editor.isActive("strike"), () => editor.chain().focus().toggleStrike().run(), "Strikethrough")}

      <select
        className={styles.tbSelect}
        title="Letter case"
        aria-label="Letter case"
        value={mark.textTransform ?? ""}
        onChange={(e) => setMark({ textTransform: e.target.value || null })}
      >
        {TRANSFORMS.map((t) => (
          <option key={t.label} value={t.value}>{t.label}</option>
        ))}
      </select>

      {tb("🔗", editor.isActive("link"), setLink, "Link")}

      <span className={styles.tbDivider} />
      {/* Colour the word, not the sentence — a headline with "-30%" in the
          accent colour is the case this editor exists for. */}
      {SWATCHES.map((s) => (
        <button
          key={s.label}
          type="button"
          title={s.value ? `${s.label} colour` : "Remove colour"}
          aria-label={s.value ? `${s.label} colour` : "Remove colour"}
          className={`${styles.swatch} ${editor.isActive("textStyle", { color: s.value }) ? styles.swatchActive : ""}`}
          style={s.value ? { background: s.value } : undefined}
          data-none={s.value ? undefined : ""}
          onMouseDown={(e) => {
            e.preventDefault();
            setMark({ color: s.value });
          }}
        />
      ))}

      <span className={styles.tbDivider} />
      {tb("Tx", false, () => editor.chain().focus().unsetAllMarks().run(), "Clear formatting")}
      {tb("↩", false, () => editor.chain().focus().undo().run(), "Undo")}
      {tb("↪", false, () => editor.chain().focus().redo().run(), "Redo")}
    </div>
  );
}

export default function RichTextEditor({ content, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [...HEADING_LEVELS] } }),
      TextStyle,
      TextStyleExtras,
      BlockTypography,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      // openOnClick would navigate away from the admin mid-edit.
      LinkExtension.configure({ openOnClick: false, autolink: true }),
    ],
    content,
    editorProps: {
      attributes: { class: styles.proseMirror },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    immediatelyRender: false,
  });

  // Sync when the parent changes content (locale / page switch via the key
  // prop, or a Generate that just filled every language at once).
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (editor.getHTML() === content) return;
    editor.commands.setContent(content, false);
  }, [content, editor]);

  return (
    <div className={styles.wrapper}>
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
