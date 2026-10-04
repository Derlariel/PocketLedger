"use client";

import { Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { BankLogo } from "@/features/accounts/bank-logo";
import { BANKS, getBank, type BankId } from "@/features/accounts/banks";
import { Input } from "@/components/ui/input";

export function BankSelector({ value, onChange, error }: { value: BankId | null; onChange: (value: BankId) => void; error?: string }) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = getBank(value);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? BANKS.filter((bank) => `${bank.name} ${bank.shortName} ${bank.code} ${bank.id}`.toLowerCase().includes(needle)) : BANKS;
  }, [query]);

  return <div className="space-y-2">
    <input type="hidden" name="bankId" value={value ?? ""} />
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden="true" />
      <Input
        id="bank-search"
        className="pl-9"
        value={query}
        placeholder={selected ? `Selected: ${selected.shortName}` : "Search by bank name or code"}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${listId}-error` : undefined}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter" && open && filtered[0]) {
            event.preventDefault();
            onChange(filtered[0].id);
            setQuery("");
            setOpen(false);
          }
        }}
      />
      {open && <div id={listId} role="listbox" className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border bg-card p-1 shadow-lg">
        {filtered.length ? filtered.map((bank) => <button
          key={bank.id}
          type="button"
          role="option"
          aria-selected={value === bank.id}
          className="flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => { onChange(bank.id); setQuery(""); setOpen(false); }}
        >
          <BankLogo bankId={bank.id} />
          <span className="min-w-0"><span className="block truncate text-sm font-medium">{bank.name}</span><span className="block text-xs text-muted-foreground">{bank.shortName} · {bank.code} · {bank.id}</span></span>
        </button>) : <p className="p-4 text-sm text-muted-foreground">No supported bank matches your search.</p>}
      </div>}
    </div>
    {selected && <div className="flex items-center gap-3 rounded-xl border bg-secondary/40 p-3"><BankLogo bankId={selected.id} /><div><p className="text-sm font-semibold">{selected.name}</p><p className="text-xs text-muted-foreground">{selected.shortName} · {selected.code} · {selected.id}</p></div></div>}
    {error && <p id={`${listId}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
