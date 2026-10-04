"use client";

import Image from "next/image";
import { Landmark } from "lucide-react";
import { useState } from "react";
import { getBank } from "@/features/accounts/banks";
import { cn } from "@/lib/utils";

export function BankLogo({ bankId, className, showName = false }: { bankId?: string | null; className?: string; showName?: boolean }) {
  const bank = getBank(bankId);
  const [failedBankId, setFailedBankId] = useState<string | null>(null);
  const failed = failedBankId === bankId;

  const mark = <span className={cn("flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white", className)}>
    {bank && !failed
      ? <Image src={bank.logoPath} alt={`${bank.shortName} logo`} width={40} height={40} className="size-full object-contain" onError={() => setFailedBankId(bank.id)} />
      : <Landmark className="size-5 text-muted-foreground" aria-hidden="true" />}
  </span>;

  if (!showName) return failed && bank ? <span className="inline-flex items-center gap-2">{mark}<span className="text-xs font-medium">{bank.shortName}</span></span> : mark;
  return <span className="flex min-w-0 items-center gap-3">{mark}<span className="min-w-0"><span className="block truncate text-sm font-medium">{bank?.shortName ?? "Bank"}</span>{failed && bank && <span className="block text-xs text-muted-foreground">{bank.shortName}</span>}</span></span>;
}
