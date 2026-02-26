import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, FileText, AlertTriangle, PenLine, Eraser } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

const formatAmount = (amount: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr), "dd MMMM yyyy", { locale: fr }); } catch { return "—"; }
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const edgeFetch = (fnName: string, options: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

// ── Inline Signature Canvas ──
const SignatureCanvas = ({ onSignatureChange }: { onSignatureChange: (dataUrl: string | null) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1a1a2e";
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

  const endDraw = useCallback(() => {
    if (drawing) {
      setDrawing(false);
      setHasDrawn(true);
      const canvas = canvasRef.current;
      if (canvas) onSignatureChange(canvas.toDataURL("image/png"));
    }
  }, [drawing, onSignatureChange]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
    onSignatureChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Signez dans le cadre ci-dessous :</p>
        {hasDrawn && (
          <Button variant="ghost" size="sm" onClick={clear} className="h-7 text-xs gap-1">
            <Eraser className="h-3 w-3" /> Effacer
          </Button>
        )}
      </div>
      <div className="rounded-xl border-2 border-dashed border-muted-foreground/30 overflow-hidden bg-white" style={{ height: 180 }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
      {!hasDrawn && (
        <p className="text-xs text-center text-muted-foreground/60 italic">
          Utilisez votre doigt ou votre souris pour signer
        </p>
      )}
    </div>
  );
};

const SignDevis = () => {
  const { token } = useParams<{ token: string }>();
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["sign-devis", token],
    queryFn: async () => {
      const res = await edgeFetch(`get-signature-data?token=${token}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Lien invalide");
      return json.data;
    },
    enabled: !!token,
  });

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!signerName.trim()) throw new Error("Le nom est requis");
      if (!signatureDataUrl) throw new Error("La signature manuscrite est requise");

      const res = await edgeFetch("submit-signature", {
        method: "POST",
        body: JSON.stringify({
          token,
          signerName: signerName.trim(),
          signerEmail: signerEmail.trim() || null,
          signatureDataUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur lors de la signature");
    },
    onSuccess: () => setSigned(true),
    onError: (e: any) => toast.error(e.message || "Erreur lors de la signature"),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Lien invalide</h1>
          <p className="text-muted-foreground">Ce lien de signature est invalide ou a expiré.</p>
        </div>
      </div>
    );
  }

  const sig = data;
  const devis = sig.devis as any;
  const client = devis?.clients as any;
  const company = devis?.companies as any;
  const isExpired = new Date(sig.expires_at) < new Date();
  const alreadySigned = sig.status === "signed";

  if (signed || alreadySigned) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Devis accepté !</h1>
          <p className="text-muted-foreground mb-1">
            {alreadySigned && !signed
              ? `Ce devis a déjà été signé par ${sig.signer_name}.`
              : `Merci ${signerName}, votre acceptation a bien été enregistrée.`}
          </p>
          {signed && (
            <p className="text-sm text-muted-foreground mt-2">
              Le devis signé vous sera envoyé par email.
            </p>
          )}
          {alreadySigned && sig.signed_at && (
            <p className="text-sm text-muted-foreground">Le {formatDate(sig.signed_at)}</p>
          )}
        </div>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Lien expiré</h1>
          <p className="text-muted-foreground">Ce lien de signature a expiré. Veuillez contacter votre prestataire.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header société */}
        <div className="rounded-xl border bg-card p-6 flex items-start gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-lg">{company?.name || company?.short_name}</h2>
            {company?.address && <p className="text-sm text-muted-foreground">{company.address}</p>}
            {company?.phone && <p className="text-sm text-muted-foreground">{company.phone}</p>}
            {company?.email && <p className="text-sm text-muted-foreground">{company.email}</p>}
          </div>
        </div>

        {/* Devis */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Devis</p>
              <h1 className="text-xl font-bold mt-0.5">{devis?.code || "—"}</h1>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Montant total</p>
              <p className="text-2xl font-bold text-primary">{formatAmount(devis?.amount || 0)}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground mb-1">Objet</p>
            <p className="font-medium">{devis?.objet}</p>
          </div>

          {client && (
            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground mb-1">Client</p>
              <p className="font-medium">{client.name}</p>
              {client.address && <p className="text-sm text-muted-foreground">{client.address}{client.postal_code ? `, ${client.postal_code}` : ""}{client.city ? ` ${client.city}` : ""}</p>}
            </div>
          )}

          {devis?.valid_until && (
            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground mb-1">Valide jusqu'au</p>
              <p className="font-medium">{formatDate(devis.valid_until)}</p>
            </div>
          )}

          {devis?.notes && (
            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm whitespace-pre-wrap">{devis.notes}</p>
            </div>
          )}
        </div>

        {/* Formulaire de signature */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Accepter ce devis</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            En acceptant ce devis, vous confirmez votre accord sur les conditions et le montant indiqués.
          </p>

          <div className="space-y-3">
            <div>
              <Label htmlFor="signer-name">Votre nom complet *</Label>
              <Input
                id="signer-name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Jean Dupont"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="signer-email">Votre email *</Label>
              <Input
                id="signer-email"
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="jean.dupont@exemple.fr"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Le devis signé vous sera envoyé à cette adresse</p>
            </div>
          </div>

          {/* Signature manuscrite */}
          <SignatureCanvas onSignatureChange={setSignatureDataUrl} />

          <Button
            className="w-full"
            size="lg"
            disabled={!signerName.trim() || !signatureDataUrl || signMutation.isPending}
            onClick={() => signMutation.mutate()}
          >
            {signMutation.isPending ? "Enregistrement..." : "✓ J'accepte et je signe ce devis"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Lien valide jusqu'au {formatDate(sig.expires_at)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignDevis;