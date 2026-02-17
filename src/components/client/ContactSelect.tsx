import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";

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
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <option value="">— Aucun contact —</option>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.is_default ? "★ " : ""}{c.civility} {c.first_name} {c.last_name}
            {c.function_title ? ` (${c.function_title})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
};
