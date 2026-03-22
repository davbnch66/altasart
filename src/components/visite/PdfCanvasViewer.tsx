import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfCanvasViewerProps {
  data: Uint8Array | ArrayBuffer | string;
}

export function PdfCanvasViewer({ data }: PdfCanvasViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const renderTasksRef = useRef<Map<number, pdfjsLib.RenderTask>>(new Map());
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.5);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        let source: { data?: Uint8Array | ArrayBuffer; url?: string };
        if (typeof data === "string" && data.startsWith("data:")) {
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
          setCurrentPage(1);
          canvasRefs.current = Array.from({ length: doc.numPages }, () => null);
        }
      } catch (err) {
        console.error("pdf.js load error:", err);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [data]);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;

    const renderAllPages = async () => {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const canvas = canvasRefs.current[pageNumber - 1];
        if (!canvas) continue;

        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = viewport.width * dpr;
        canvas.height = viewport.height * dpr;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const existingTask = renderTasksRef.current.get(pageNumber);
        if (existingTask) {
          try {
            existingTask.cancel();
          } catch {}
        }

        const task = page.render({ canvasContext: ctx, viewport });
        renderTasksRef.current.set(pageNumber, task);

        try {
          await task.promise;
        } catch (e: any) {
          if (e?.name !== "RenderingCancelledException") {
            console.error(e);
          }
        }
      }
    };

    renderAllPages();

    return () => {
      cancelled = true;
      renderTasksRef.current.forEach((task) => {
        try {
          task.cancel();
        } catch {}
      });
      renderTasksRef.current.clear();
    };
  }, [pdf, scale]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || numPages === 0) return;

    const updateCurrentPage = () => {
      const containerTop = container.getBoundingClientRect().top;
      let nearestPage = 1;
      let nearestDistance = Number.POSITIVE_INFINITY;

      canvasRefs.current.forEach((canvas, index) => {
        if (!canvas) return;
        const distance = Math.abs(canvas.getBoundingClientRect().top - containerTop - 16);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestPage = index + 1;
        }
      });

      setCurrentPage(nearestPage);
    };

    updateCurrentPage();
    container.addEventListener("scroll", updateCurrentPage, { passive: true });
    return () => container.removeEventListener("scroll", updateCurrentPage);
  }, [numPages, scale]);

  const scrollToPage = (pageNumber: number) => {
    const canvas = canvasRefs.current[pageNumber - 1];
    if (!canvas) return;
    canvas.scrollIntoView({ behavior: "smooth", block: "start" });
    setCurrentPage(pageNumber);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-center gap-2 py-2 px-3 border-b bg-muted/30 shrink-0">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground min-w-[80px] text-center">
          {currentPage} / {numPages}
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => scrollToPage(Math.min(numPages, currentPage + 1))}
          disabled={currentPage >= numPages}
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

      <div ref={containerRef} className="flex-1 min-h-0 overflow-auto bg-muted/10 p-4">
        <div className="mx-auto flex w-fit flex-col gap-4">
          {Array.from({ length: numPages }, (_, index) => (
            <canvas
              key={index + 1}
              ref={(node) => {
                canvasRefs.current[index] = node;
              }}
              className="shadow-lg bg-background"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
