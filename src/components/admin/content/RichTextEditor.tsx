"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import styles from "./RichTextEditor.module.css";

interface Props {
  content: string;
  onChange: (html: string) => void;
}

export default function RichTextEditor({ content, onChange }: Props) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    editorProps: {
      attributes: { class: styles.proseMirror },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sync when parent changes content (locale / page switch via key prop)
  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.getHTML() !== content) {
      editor.commands.setContent(content, false);
    }
  }, [content, editor]);

  const tb = (
    label: string,
    active: boolean,
    action: () => void,
    title: string,
  ) => (
    <button
      key={label}
      type="button"
      title={title}
      className={`${styles.tbBtn} ${active ? styles.tbBtnActive : ""}`}
      onMouseDown={e => { e.preventDefault(); action(); }}
    >
      {label}
    </button>
  );

  return (
    <div className={styles.wrapper}>
      {editor && (
        <div className={styles.toolbar}>
          {tb("B",  editor.isActive("bold"),          () => editor.chain().focus().toggleBold().run(),         "Bold")}
          {tb("I",  editor.isActive("italic"),         () => editor.chain().focus().toggleItalic().run(),       "Italic")}
          {tb("S",  editor.isActive("strike"),         () => editor.chain().focus().toggleStrike().run(),       "Strikethrough")}
          <span className={styles.tbDivider} />
          {tb("H2", editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "Heading 2")}
          {tb("H3", editor.isActive("heading", { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), "Heading 3")}
          <span className={styles.tbDivider} />
          {tb("•—", editor.isActive("bulletList"),     () => editor.chain().focus().toggleBulletList().run(),   "Bullet list")}
          {tb("1—", editor.isActive("orderedList"),    () => editor.chain().focus().toggleOrderedList().run(),  "Numbered list")}
          <span className={styles.tbDivider} />
          {tb("↩",  false,                             () => editor.chain().focus().undo().run(),                "Undo")}
          {tb("↪",  false,                             () => editor.chain().focus().redo().run(),                "Redo")}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
