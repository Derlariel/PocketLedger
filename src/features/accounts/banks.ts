export type Bank = {
  id: "bbl" | "kbank" | "ktb" | "scb";
  name: string;
  shortName: string;
  code: string;
  logoPath: string;
};

export const BANKS = [
  { id: "bbl", name: "Bangkok Bank Public Company Limited", shortName: "Bangkok Bank", code: "002 · BBL", logoPath: "/assets/bank_logo/Bangkok.jpg" },
  { id: "kbank", name: "Kasikornbank Public Company Limited", shortName: "KBank", code: "004 · KBANK", logoPath: "/assets/bank_logo/KBank.jpg" },
  { id: "ktb", name: "Krung Thai Bank Public Company Limited", shortName: "Krungthai", code: "006 · KTB", logoPath: "/assets/bank_logo/Krung_Thai_Bank_logo.svg" },
  { id: "scb", name: "Siam Commercial Bank Public Company Limited", shortName: "SCB", code: "014 · SCB", logoPath: "/assets/bank_logo/SCB-bank.jpg" },
] as const satisfies readonly Bank[];

export type BankId = (typeof BANKS)[number]["id"];

export function getBank(id: string | null | undefined) {
  return BANKS.find((bank) => bank.id === id);
}

export function maskLastFour(lastFour: string | null | undefined) {
  return lastFour ? `•••• ${lastFour}` : "Not provided";
}
