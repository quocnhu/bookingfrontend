"use client";

/**
 * TipTap headless editor + custom UI (The Modern Industry Standard).
 * No rich-text widget from a UI kit — the toolbar, bubble menu and link
 * prompt are all hand-built antd controls driven by the headless engine.
 */
import { forwardRef, useImperativeHandle } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { TextSelection } from "prosemirror-state";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Indent } from "./tiptap-indent";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Button, Card, Divider, Flex, Select, Tooltip } from "antd";
import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  StrikethroughOutlined,
  CodeOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  BlockOutlined,
  MinusOutlined,
  LinkOutlined,
  TableOutlined,
  PictureOutlined,
  PlusOutlined,
  DeleteOutlined,
  VerticalAlignTopOutlined,
  VerticalAlignBottomOutlined,
  UndoOutlined,
  RedoOutlined,
} from "@ant-design/icons";

export interface RichTextEditorHandle {
  getHTML: () => string;
  clear: () => void;
}

interface RichTextEditorProps {
  initialHtml?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

const toolButton = (
  editor: any,
  title: string,
  icon: React.ReactNode,
  action: () => void,
  active = false,
  disabled = false,
) => (
  <Tooltip title={title} key={title}>
    <Button
      size="small"
      type={active ? "primary" : "default"}
      icon={icon}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={action}
    />
  </Tooltip>
);

const moveTable = (editor: any, dir: -1 | 1): boolean => {
  const { state } = editor;
  const $from = state.selection.$from;
  const table = $from.node(-1);
  if (!table || table.type.name !== "table") return false;

  const tableStart = $from.before(-1);
  const tableEnd = $from.after(-1);
  const atStart = state.doc.resolve(tableStart);
  const atEnd = state.doc.resolve(tableEnd);

  let target: number | null = null;
  if (dir === -1) {
    const prev = atStart.nodeBefore;
    if (prev) target = atStart.pos - prev.nodeSize;
  } else {
    const next = atEnd.nodeAfter;
    if (next) target = atEnd.pos + next.nodeSize;
  }
  if (target === null) return false;

  const tr = state.tr.delete(tableStart, tableEnd);
  const insertPos = dir === -1 ? target : target - table.nodeSize;
  tr.insert(insertPos, table);
  tr.setSelection(TextSelection.create(tr.doc, insertPos + 1));
  editor.view.dispatch(tr);
  editor.view.focus();
  return true;
};

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  function RichTextEditor(
    { initialHtml = "", onChange, placeholder = "Start writing…", minHeight = 180 },
    ref,
  ) {
    const editor = useEditor({
      extensions: [
        StarterKit.configure({ link: { openOnClick: false } }),
        Indent,
        Image.configure({ inline: false }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
      ],
      content: initialHtml || "<p></p>",
      editorProps: {
        attributes: {
          class: "tiptap",
          style: `min-height: ${minHeight}px; padding: 4px 2px;`,
        },
      },
      onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    });

    useImperativeHandle(ref, () => ({
      getHTML: () => editor?.getHTML() ?? "",
      clear: () => editor?.commands.setContent("<p></p>"),
    }));

    if (!editor) return null;

    const setLink = () => {
      const prev = (editor.getAttributes("link").href as string) ?? "";
      const url = window.prompt("Link URL", prev);
      if (url === null) return;
      if (!url.trim()) {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
        return;
      }
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    };

    const setImage = () => {
      const url = window.prompt("Image URL (paste a hosted image link)");
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    };

    const insertTable = () => {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    };

    const headingLevel = editor.isActive("heading")
      ? (editor.getAttributes("heading").level as number) || 2
      : 0;

    const bubble = (disabled = false) => (
      <Flex
        gap={2}
        align="center"
        style={{
          padding: 4,
          borderRadius: 10,
          background: "var(--ant-color-bg-elevated)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
          border: "1px solid var(--ant-color-border-secondary)",
        }}
      >
        {toolButton(editor, "Bold", <BoldOutlined />, () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"), disabled)}
        {toolButton(editor, "Italic", <ItalicOutlined />, () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"), disabled)}
        {toolButton(editor, "Underline", <UnderlineOutlined />, () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"), disabled)}
        {toolButton(editor, "Strikethrough", <StrikethroughOutlined />, () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"), disabled)}
        {toolButton(editor, "Inline code", <CodeOutlined />, () => editor.chain().focus().toggleCode().run(), editor.isActive("code"), disabled)}
        <Divider type="vertical" style={{ margin: "0 2px" }} />
        {toolButton(editor, "Link", <LinkOutlined />, setLink, editor.isActive("link"), disabled)}
      </Flex>
    );

    const toolbar = (
      <Flex gap={4} wrap align="center">
        <Select
          size="small"
          value={headingLevel}
          style={{ width: 120 }}
          options={[
            { label: "Paragraph", value: 0 },
            { label: "Heading 1", value: 1 },
            { label: "Heading 2", value: 2 },
            { label: "Heading 3", value: 3 },
          ]}
          onChange={(level: number) => {
            if (level === 0) editor.chain().focus().setParagraph().run();
            else
              editor
                .chain()
                .focus()
                .setHeading({ level: level as 1 | 2 | 3 })
                .run();
          }}
        />
        <Divider type="vertical" style={{ margin: "0 4px" }} />
        {toolButton(editor, "Bold", <BoldOutlined />, () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
        {toolButton(editor, "Italic", <ItalicOutlined />, () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
        {toolButton(editor, "Underline", <UnderlineOutlined />, () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"))}
        {toolButton(editor, "Strikethrough", <StrikethroughOutlined />, () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"))}
        {toolButton(editor, "Inline code", <CodeOutlined />, () => editor.chain().focus().toggleCode().run(), editor.isActive("code"))}
        {toolButton(editor, "Link", <LinkOutlined />, setLink, editor.isActive("link"))}
        <Divider type="vertical" style={{ margin: "0 4px" }} />
        {toolButton(editor, "Bullet list", <UnorderedListOutlined />, () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
        {toolButton(editor, "Ordered list", <OrderedListOutlined />, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
        {toolButton(editor, "Quote", <BlockOutlined />, () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}
        <Divider type="vertical" style={{ margin: "0 4px" }} />
        {toolButton(editor, "Increase indent (Tab)", <MenuUnfoldOutlined />, () => editor.chain().focus().indent().run(), false, !editor.can().chain().focus().indent().run())}
        {toolButton(editor, "Decrease indent (Shift+Tab)", <MenuFoldOutlined />, () => editor.chain().focus().outdent().run(), false, !editor.can().chain().focus().outdent().run())}
        {toolButton(editor, "Horizontal rule", <MinusOutlined />, () => editor.chain().focus().setHorizontalRule().run())}
        <Divider type="vertical" style={{ margin: "0 4px" }} />
        {toolButton(editor, "Image", <PictureOutlined />, setImage)}
        {toolButton(editor, "Insert table", <TableOutlined />, insertTable, editor.isActive("table"))}
        {editor.isActive("table") && (
          <>
            {toolButton(editor, "Move table up", <VerticalAlignTopOutlined />, () => moveTable(editor, -1), false, !editor.isActive("table"))}
            {toolButton(editor, "Move table down", <VerticalAlignBottomOutlined />, () => moveTable(editor, 1), false, !editor.isActive("table"))}
            {toolButton(editor, "Add row below", <PlusOutlined />, () => editor.chain().focus().addRowAfter().run())}
            {toolButton(editor, "Delete row", <DeleteOutlined />, () => editor.chain().focus().deleteRow().run())}
            {toolButton(editor, "Add column right", <PlusOutlined />, () => editor.chain().focus().addColumnAfter().run())}
            {toolButton(editor, "Delete column", <DeleteOutlined />, () => editor.chain().focus().deleteColumn().run())}
            {toolButton(editor, "Delete table", <DeleteOutlined />, () => editor.chain().focus().deleteTable().run())}
          </>
        )}
        <Divider type="vertical" style={{ margin: "0 4px" }} />
        {toolButton(editor, "Undo", <UndoOutlined />, () => editor.chain().focus().undo().run(), false, !editor.can().chain().focus().undo().run())}
        {toolButton(editor, "Redo", <RedoOutlined />, () => editor.chain().focus().redo().run(), false, !editor.can().chain().focus().redo().run())}
      </Flex>
    );

    return (
      <Flex vertical gap={8}>
        <Card styles={{ body: { padding: 8 } }} size="small">
          {toolbar}
        </Card>
        <Card styles={{ body: { padding: 12 } }}>
          <BubbleMenu editor={editor}>
            {bubble()}
          </BubbleMenu>
          <EditorContent editor={editor} />
        </Card>
      </Flex>
    );
  },
);

export default RichTextEditor;
