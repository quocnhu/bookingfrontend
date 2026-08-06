"use client";

import { forwardRef, useImperativeHandle } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Button, Card, Divider, Flex, Select, Space, Tooltip } from "antd";
import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  StrikethroughOutlined,
  CodeOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  BlockOutlined,
  MinusOutlined,
  LinkOutlined,
  TableOutlined,
  PictureOutlined,
  PlusOutlined,
  DeleteOutlined,
  UndoOutlined,
  RedoOutlined,
} from "@ant-design/icons";

export interface ItineraryEditorHandle {
  getHTML: () => string;
}

const toolButton = (
  editor: any,
  title: string,
  icon: React.ReactNode,
  action: () => void,
  active = false,
) => (
  <Tooltip title={title} key={title}>
    <Button
      size="small"
      type={active ? "primary" : "default"}
      icon={icon}
      onClick={action}
    />
  </Tooltip>
);

const ItineraryEditor = forwardRef<
  ItineraryEditorHandle,
  { initialHtml?: string; onChange?: (html: string) => void }
>(function ItineraryEditor({ initialHtml = "", onChange }, ref) {
    const editor = useEditor({
      extensions: [
        StarterKit.configure({ link: { openOnClick: false } }),
        Image.configure({ inline: false }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
      ],
      content: initialHtml || "<p></p>",
      onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    });

    useImperativeHandle(ref, () => ({
      getHTML: () => editor?.getHTML() ?? "",
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
      const url = window.prompt("Image URL");
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

    const toolbar = (
      <Flex gap={4} wrap align="center">
        <Select
          size="small"
          value={headingLevel}
          style={{ width: 130 }}
          options={[
            { label: "Paragraph", value: 0 },
            { label: "Heading 1", value: 1 },
            { label: "Heading 2", value: 2 },
            { label: "Heading 3", value: 3 },
          ]}
          onChange={(level: number) => {
            if (level === 0) editor.chain().focus().setParagraph().run();
            else editor.chain().focus().setHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
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
        {toolButton(editor, "Code block", <CodeOutlined />, () => editor.chain().focus().toggleCodeBlock().run(), editor.isActive("codeBlock"))}
        {toolButton(editor, "Quote", <BlockOutlined />, () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}
        {toolButton(editor, "Horizontal rule", <MinusOutlined />, () => editor.chain().focus().setHorizontalRule().run())}
        <Divider type="vertical" style={{ margin: "0 4px" }} />
        {toolButton(editor, "Image", <PictureOutlined />, setImage)}
        {toolButton(editor, "Insert table", <TableOutlined />, insertTable, editor.isActive("table"))}
        {editor.isActive("table") && (
          <>
            {toolButton(editor, "Add row below", <PlusOutlined />, () => editor.chain().focus().addRowAfter().run())}
            {toolButton(editor, "Delete row", <DeleteOutlined />, () => editor.chain().focus().deleteRow().run())}
            {toolButton(editor, "Add column right", <PlusOutlined />, () => editor.chain().focus().addColumnAfter().run())}
            {toolButton(editor, "Delete column", <DeleteOutlined />, () => editor.chain().focus().deleteColumn().run())}
          </>
        )}
        <Divider type="vertical" style={{ margin: "0 4px" }} />
        {toolButton(editor, "Undo", <UndoOutlined />, () => editor.chain().focus().undo().run(), !editor.can().chain().focus().undo().run())}
        {toolButton(editor, "Redo", <RedoOutlined />, () => editor.chain().focus().redo().run(), !editor.can().chain().focus().redo().run())}
      </Flex>
    );

    return (
      <Flex vertical gap={12}>
        <Card styles={{ body: { padding: 8 } }} size="small">
          {toolbar}
        </Card>
        <Card styles={{ body: { padding: 12 } }}>
          <EditorContent editor={editor} />
        </Card>
      </Flex>
    );
  },
);

export default ItineraryEditor;
