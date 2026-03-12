import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";
import { useCompany } from "@/contexts/CompanyContext";

const companyColorMap: Record<string, { bg: string; fg: string }> = {
  "primary": { bg: "hsl(var(--primary))", fg: "hsl(var(--primary-foreground))" },
  "company-art": { bg: "hsl(var(--company-art))", fg: "hsl(var(--company-art-foreground))" },
  "company-altigrues": { bg: "hsl(var(--company-altigrues))", fg: "hsl(var(--company-altigrues-foreground))" },
  "company-asdgm": { bg: "hsl(var(--company-asdgm))", fg: "hsl(var(--company-asdgm-foreground))" },
};

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, style, ...props }, ref) => {
  let companyColor = "primary";
  try {
    const { currentCompany } = useCompany();
    companyColor = currentCompany.color;
  } catch {
    // Outside CompanyProvider, use default
  }
  const colors = companyColorMap[companyColor] || companyColorMap["primary"];

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      style={{
        ...style,
        "--_tab-bg": colors.bg,
        "--_tab-fg": colors.fg,
      } as React.CSSProperties}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
