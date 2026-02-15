import React, { createContext, useContext, useState } from "react";

export type CompanyId = "art" | "altigrues" | "asdgm" | "global";

export interface Company {
  id: CompanyId;
  name: string;
  shortName: string;
  color: string;
}

export const companies: Company[] = [
  { id: "global", name: "Vue globale", shortName: "Global", color: "primary" },
  { id: "art", name: "ART Levage", shortName: "ART", color: "company-art" },
  { id: "altigrues", name: "Altigrues", shortName: "ALT", color: "company-altigrues" },
  { id: "asdgm", name: "ASDGM", shortName: "ASDGM", color: "company-asdgm" },
];

interface CompanyContextType {
  current: CompanyId;
  setCurrent: (id: CompanyId) => void;
  currentCompany: Company;
}

const CompanyContext = createContext<CompanyContextType | null>(null);

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [current, setCurrent] = useState<CompanyId>("global");
  const currentCompany = companies.find((c) => c.id === current) || companies[0];

  return (
    <CompanyContext.Provider value={{ current, setCurrent, currentCompany }}>
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
};
