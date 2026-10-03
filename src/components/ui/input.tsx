import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("flex min-h-11 w-full rounded-xl border bg-background px-3 py-2 text-base placeholder:text-muted-foreground disabled:opacity-50 md:text-sm", className)} {...props} />;
}
