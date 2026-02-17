import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Star, Phone, Mail } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface Contact {
  id: string;
  code: string | null;
  civility: string | null;
  first_name: string | null;
  last_name: string;
  mobile: string | null;
  phone_direct: string | null;
  phone_office: string | null;
  email: string | null;
  function_title: string | null;
  is_default: boolean;
  notes: string | null;
}

interface Props {
  clientId: string;
  companyId: string;
}

const civilityOptions = ["Monsieur", "Madame", "MR", "MME", "AMBASSADE"];

const emptyContact = {
  code: "",
  civility: "Monsieur",
  first_name: "",
  last_name: "",
  mobile: "",
  phone_direct: "",
  phone_office: "",
  email: "",
  function_title: "",
  is_default: false,
  notes: "",
};

export const ClientContactsTab = ({ clientId, companyId }: Props) => {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyContact);

  const { data: contacts = [] } = useQuery({
    queryKey: ["client-contacts", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contacts")
        .select("*")
        .eq("client_id", clientId)
        .order("is_default", { ascending: false })
        .order("last_name");
      if (error) throw error;
      return data as Contact[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form & { id?: string }) => {
      const payload = {
        client_id: clientId,
        company_id: companyId,
        code: data.code || null,
        civility: data.civility || null,
        first_name: data.first_name || null,
        last_name: data.last_name,
        mobile: data.mobile || null,
        phone_direct: data.phone_direct || null,
        phone_office: data.phone_office || null,
        email: data.email || null,
        function_title: data.function_title || null,
        is_default: data.is_default,
        notes: data.notes || null,
      };
      if (data.id) {
        const { error } = await supabase.from("client_contacts").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("client_contacts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingContact ? "Contact modifié" : "Contact ajouté");
      queryClient.invalidateQueries({ queryKey: ["client-contacts", clientId] });
      setEditingContact(null);
      setCreating(false);
      setForm(emptyContact);
    },
    onError: () => toast.error("Erreur lors de l'enregistrement"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contact supprimé");
      queryClient.invalidateQueries({ queryKey: ["client-contacts", clientId] });
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const openEdit = (c: Contact) => {
    setEditingContact(c);
    setForm({
      code: c.code || "",
      civility: c.civility || "Monsieur",
      first_name: c.first_name || "",
      last_name: c.last_name,
      mobile: c.mobile || "",
      phone_direct: c.phone_direct || "",
      phone_office: c.phone_office || "",
      email: c.email || "",
      function_title: c.function_title || "",
      is_default: c.is_default,
      notes: c.notes || "",
    });
  };

  const openCreate = () => {
    setCreating(true);
    setEditingContact(null);
    setForm(emptyContact);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.last_name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    saveMutation.mutate({ ...form, id: editingContact?.id });
  };

  const dialogOpen = creating || !!editingContact;

  return (
    <div>
      <div className={`flex items-center justify-between ${isMobile ? "mb-2" : "mb-4"}`}>
        <h3 className="font-semibold text-sm">Contacts / D.O.</h3>
        <Button size="sm" onClick={openCreate} className="text-xs">
          <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
        </Button>
      </div>

      {contacts.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground text-sm">Aucun contact</p>
      ) : isMobile ? (
        <div className="space-y-2">
          {contacts.map((c) => (
            <div key={c.id} className="rounded-xl border bg-card p-3 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {c.is_default && <Star className="h-3.5 w-3.5 text-warning fill-warning" />}
                  <span className="font-medium text-sm">
                    {c.civility} {c.first_name} {c.last_name}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  <button onClick={() => deleteMutation.mutate(c.id)} className="p-1.5 rounded hover:bg-muted"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                </div>
              </div>
              {c.function_title && <p className="text-xs text-muted-foreground">{c.function_title}</p>}
              <div className="flex flex-wrap gap-2 text-xs">
                {c.mobile && (
                  <a href={`tel:${c.mobile}`} className="flex items-center gap-1 text-primary hover:underline">
                    <Phone className="h-3 w-3" /> {c.mobile}
                  </a>
                )}
                {c.email && (
                  <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-primary hover:underline">
                    <Mail className="h-3 w-3" /> {c.email}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5 w-10"></th>
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Code</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Civilité</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Nom</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Portable</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">E-mail</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Tél. direct</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Fonction</th>
                <th className="px-4 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5">{c.is_default && <Star className="h-3.5 w-3.5 text-warning fill-warning" />}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{c.code || "—"}</td>
                  <td className="px-4 py-2.5 text-xs">{c.civility || "—"}</td>
                  <td className="px-4 py-2.5 font-medium">{c.first_name} {c.last_name}</td>
                  <td className="px-4 py-2.5">
                    {c.mobile ? (
                      <a href={`tel:${c.mobile}`} className="text-primary hover:underline text-xs">{c.mobile}</a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {c.email ? (
                      <a href={`mailto:${c.email}`} className="text-primary hover:underline text-xs truncate max-w-[200px] block">{c.email}</a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs">{c.phone_direct || "—"}</td>
                  <td className="px-4 py-2.5 text-xs">{c.function_title || "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(c)} className="p-1 rounded hover:bg-muted"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                      <button onClick={() => deleteMutation.mutate(c.id)} className="p-1 rounded hover:bg-muted"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) { setCreating(false); setEditingContact(null); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingContact ? "Modifier le contact" : "Nouveau contact"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Code</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="1" />
              </div>
              <div>
                <Label>Civilité</Label>
                <select
                  value={form.civility}
                  onChange={(e) => setForm({ ...form, civility: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {civilityOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Prénom</Label>
                <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div>
                <Label>Nom *</Label>
                <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
              <div>
                <Label>Portable</Label>
                <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="06 00 00 00 00" />
              </div>
              <div>
                <Label>Tél. direct</Label>
                <Input value={form.phone_direct} onChange={(e) => setForm({ ...form, phone_direct: e.target.value })} placeholder="01 00 00 00 00" />
              </div>
              <div>
                <Label>Tél. bureau</Label>
                <Input value={form.phone_office} onChange={(e) => setForm({ ...form, phone_office: e.target.value })} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Fonction / Poste</Label>
                <Input value={form.function_title} onChange={(e) => setForm({ ...form, function_title: e.target.value })} placeholder="Responsable travaux" />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={form.is_default}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="is_default" className="cursor-pointer">Contact principal</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setCreating(false); setEditingContact(null); }}>Annuler</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
