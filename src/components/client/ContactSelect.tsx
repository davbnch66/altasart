import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  clientId: string;
  value: string;
  onChange: (contactId: string) => void;
  label?: string;
}

export const ContactSelect = ({ clientId, value, onChange, label = "Contact" }: Props) => {
  const { data: contacts = [] } = useQuery({
    queryKey: ["client-contacts-select", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_contacts")
        .select("id, civility, first_name, last_name, mobile, email, is_default, function_title")
        .eq("client_id", clientId)
        .order("is_default", { ascending: false })
        .order("last_name");
      return data || [];
    },
    enabled: !!clientId,
  });

  if (contacts.length === 0) return null;

  return (
    <div>
      <Label>{label}</Label>
      <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? "" : v)}>
        <SelectTrigger>
          <SelectValue placeholder="— Aucun contact —" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">— Aucun contact —</SelectItem>
          {contacts.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.is_default ? "★ " : ""}{c.civility} {c.first_name} {c.last_name}
              {c.function_title ? ` (${c.function_title})` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};