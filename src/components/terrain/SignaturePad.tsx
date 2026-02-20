import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SignaturePadProps {
  onSave: (dataUrl: string, signerName?: string) => void;
  onCancel: () => void;
  title: string;
  signerLabel?: string;
  /** If provided, show a dropdown instead of free text input */
  signerOptions?: { id: string; name: string }[];
}

export function SignaturePad({ onSave, onCancel, title, signerLabel, signerOptions }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signerName, setSignerName] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to match display size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1a1a2e";
    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setDrawing(true);
    setHasDrawn(true);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => setDrawing(false);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl, signerName);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex flex-col p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold">{title}</h2>
        <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs">
          Annuler
        </Button>
      </div>

      {signerLabel && (
        <div className="mb-3">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">{signerLabel}</label>
          {signerOptions && signerOptions.length > 0 ? (
            <Select value={signerName} onValueChange={setSignerName}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choisir un intervenant" />
              </SelectTrigger>
              <SelectContent>
                {signerOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.name}>{opt.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Nom du signataire"
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0">
        <p className="text-xs text-muted-foreground mb-2">Signez dans le cadre ci-dessous :</p>
        <div className="flex-1 rounded-xl border-2 border-dashed border-muted-foreground/30 overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            className="w-full h-full touch-none"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <Button variant="outline" size="sm" onClick={clear} className="flex-1">
          <Eraser className="h-4 w-4 mr-1" /> Effacer
        </Button>
        <Button
          size="sm"
          disabled={!hasDrawn}
          onClick={save}
          className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
        >
          <Check className="h-4 w-4 mr-1" /> Valider
        </Button>
      </div>
    </div>
  );
}
