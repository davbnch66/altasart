import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

// Use the same version worker from CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfCanvasViewerProps {
  data: Uint8Array | ArrayBuffer | string; // raw bytes or data URI
}

export function PdfCanvasViewer({ data }: PdfCanvasViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  // Load document
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        let source: any;
        if (typeof data === "string" && data.startsWith("data:")) {
          // Convert data URI to Uint8Array
          const base64 = data.split(",")[1];
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          source = { data: bytes };
        } else if (typeof data === "string") {
          source = { url: data };
        } else {
          source = { data };
        }

        const doc = await pdfjsLib.getDocument(source).promise;
        if (!cancelled) {
          setPdf(doc);
          setNumPages(doc.numPages);
          setPage(1);
        }
      } catch (err) {
        console.error("pdf.js load error:", err);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [data]);

  // Render current page
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;

    async function render() {
      const pageObj = await pdf!.getPage(page);
      if (cancelled) return;

      const viewport = pageObj.getViewport({ scale });
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;

      // HiDPI support
      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Cancel previous render
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch {}
      }

      const task = pageObj.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch (e: any) {
        if (e?.name !== "RenderingCancelledException") console.error(e);
      }
    }

    render();
    return () => { cancelled = true; };
  }, [pdf, page, scale]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-center gap-2 py-2 px-3 border-b bg-muted/30 shrink-0">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground min-w-[80px] text-center">
          {page} / {numPages}
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setPage((p) => Math.min(numPages, p + 1))}
          disabled={page >= numPages}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
          disabled={scale <= 0.5}
          className="h-8 w-8"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground w-12 text-center">
          {Math.round(scale * 100)}%
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setScale((s) => Math.min(3, s + 0.25))}
          disabled={scale >= 3}
          className="h-8 w-8"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-auto flex justify-center p-4 bg-muted/10">
        <canvas ref={canvasRef} className="shadow-lg" />
      </div>
    </div>
  );
}
