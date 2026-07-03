import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

function Accordion({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={className} {...props} />;
}

function AccordionItem({
  className,
  value: _value,
  ...props
}: React.ComponentProps<"details"> & { value?: string }) {
  return <details className={cn("group", className)} {...props} />;
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<"summary">) {
  return (
    <summary
      className={cn(
        "flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden",
        className
      )}
      {...props}
    >
      <span>{children}</span>
      <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
    </summary>
  );
}

function AccordionContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={className} {...props} />;
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
