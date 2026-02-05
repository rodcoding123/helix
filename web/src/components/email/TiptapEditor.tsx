import React, { useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight } from 'lowlight';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
} from 'lucide-react';

interface TiptapEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: number;
  maxHeight?: number;
}

interface MenuButtonProps {
  isActive: boolean;
  onClick: () => void;
  title: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

const MenuButton: React.FC<MenuButtonProps> = ({
  isActive,
  onClick,
  title,
  icon,
  disabled,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-2 rounded transition-colors ${
      disabled
        ? 'opacity-50 cursor-not-allowed'
        : isActive
          ? 'bg-blue-100 text-blue-600'
          : 'hover:bg-gray-100 text-gray-700'
    }`}
    aria-pressed={isActive}
  >
    {icon}
  </button>
);

export const TiptapEditor: React.FC<TiptapEditorProps> = ({
  value,
  onChange,
  disabled = false,
  minHeight = 300,
  maxHeight = 600,
}) => {
  const lowlight = createLowlight();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editable: !disabled,
    immediatelyRender: false,
  });

  const toggleBold = useCallback(() => {
    editor?.chain().focus().toggleBold().run();
  }, [editor]);

  const toggleItalic = useCallback(() => {
    editor?.chain().focus().toggleItalic().run();
  }, [editor]);

  const toggleStrike = useCallback(() => {
    editor?.chain().focus().toggleStrike().run();
  }, [editor]);

  const toggleCode = useCallback(() => {
    editor?.chain().focus().toggleCode().run();
  }, [editor]);

  const toggleCodeBlock = useCallback(() => {
    editor?.chain().focus().toggleCodeBlock().run();
  }, [editor]);

  const toggleBulletList = useCallback(() => {
    editor?.chain().focus().toggleBulletList().run();
  }, [editor]);

  const toggleOrderedList = useCallback(() => {
    editor?.chain().focus().toggleOrderedList().run();
  }, [editor]);

  const toggleBlockquote = useCallback(() => {
    editor?.chain().focus().toggleBlockquote().run();
  }, [editor]);

  const setLink = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', previousUrl);

    if (url === null) {
      return;
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url })
      .run();
  }, [editor]);

  const undo = useCallback(() => {
    editor?.chain().focus().undo().run();
  }, [editor]);

  const redo = useCallback(() => {
    editor?.chain().focus().redo().run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="border-b bg-gray-50 p-2 flex flex-wrap gap-1">
        <MenuButton
          isActive={editor.isActive('bold')}
          onClick={toggleBold}
          title="Bold (Ctrl+B)"
          icon={<Bold size={18} />}
          disabled={disabled}
        />
        <MenuButton
          isActive={editor.isActive('italic')}
          onClick={toggleItalic}
          title="Italic (Ctrl+I)"
          icon={<Italic size={18} />}
          disabled={disabled}
        />
        <MenuButton
          isActive={editor.isActive('strike')}
          onClick={toggleStrike}
          title="Strikethrough"
          icon={<Strikethrough size={18} />}
          disabled={disabled}
        />
        <MenuButton
          isActive={editor.isActive('code')}
          onClick={toggleCode}
          title="Code"
          icon={<Code size={18} />}
          disabled={disabled}
        />

        <div className="border-l border-gray-300 mx-1" />

        <MenuButton
          isActive={editor.isActive('codeBlock')}
          onClick={toggleCodeBlock}
          title="Code Block"
          icon={<Code size={18} />}
          disabled={disabled}
        />
        <MenuButton
          isActive={editor.isActive('bulletList')}
          onClick={toggleBulletList}
          title="Bullet List"
          icon={<List size={18} />}
          disabled={disabled}
        />
        <MenuButton
          isActive={editor.isActive('orderedList')}
          onClick={toggleOrderedList}
          title="Ordered List"
          icon={<ListOrdered size={18} />}
          disabled={disabled}
        />
        <MenuButton
          isActive={editor.isActive('blockquote')}
          onClick={toggleBlockquote}
          title="Quote"
          icon={<Quote size={18} />}
          disabled={disabled}
        />

        <div className="border-l border-gray-300 mx-1" />

        <MenuButton
          isActive={editor.isActive('link')}
          onClick={setLink}
          title="Add Link"
          icon={<LinkIcon size={18} />}
          disabled={disabled}
        />

        <div className="border-l border-gray-300 mx-1 ml-auto" />

        <MenuButton
          onClick={undo}
          isActive={false}
          title="Undo"
          icon={<Undo size={18} />}
          disabled={disabled || !editor.can().undo()}
        />
        <MenuButton
          onClick={redo}
          isActive={false}
          title="Redo"
          icon={<Redo size={18} />}
          disabled={disabled || !editor.can().redo()}
        />
      </div>

      {/* Editor Content */}
      <div
        style={{
          minHeight: `${minHeight}px`,
          maxHeight: `${maxHeight}px`,
        }}
        className="overflow-y-auto p-4"
      >
        <EditorContent
          editor={editor}
          className={`prose prose-sm max-w-none focus:outline-none ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        />
      </div>
    </div>
  );
};

export default TiptapEditor;
