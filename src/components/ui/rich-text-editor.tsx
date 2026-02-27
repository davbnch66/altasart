import { useRef, useCallback, useEffect } from "react";
import DOMPurify from "dompurify";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export const RichTextEditor = ({
  value,
  onChange,
  placeholder = "Saisissez votre texte...",
  className,
  minHeight = "150px",
}: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  // Sync value from outside (initial load or external updates)
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      const sanitized = DOMPurify.sanitize(value);
      if (editorRef.current.innerHTML !== sanitized) {
        editorRef.current.innerHTML = sanitized;
      }
    }
    isInternalChange.current = false;
  }, [value]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalChange.current = true;
      const html = DOMPurify.sanitize(editorRef.current.innerHTML);
      onChange(html);
    }
  }, [onChange]);

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const toolbarButtons = [
    { icon: Bold, command: "bold", label: "Gras" },
    { icon: Italic, command: "italic", label: "Italique" },
    { icon: List, command: "insertUnorderedList", label: "Liste à puces" },
    { icon: ListOrdered, command: "insertOrderedList", label: "Liste numérotée" },
  ];

  return (
    <div className={cn("rounded-md border bg-background", className)}>
      <div className="flex items-center gap-0.5 border-b px-2 py-1">
        {toolbarButtons.map((btn) => (
          <Button
            key={btn.command}
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={btn.label}
            onMouseDown={(e) => {
              e.preventDefault();
              execCommand(btn.command);
            }}
          >
            <btn.icon className="h-3.5 w-3.5" />
          </Button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="px-3 py-2 text-sm outline-none prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5"
        style={{ minHeight }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
    </div>
  );
};
