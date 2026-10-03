import Link from "next/link";
import { Activity, BarChart3, FileSearch, FolderOpen, Gauge, Landmark, PiggyBank, ReceiptText, Settings, Upload, WalletCards } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { signOut } from "@/app/auth/actions";
import { Button } from "./ui/button";

const navigation = [
  ["ภาพรวม", "/dashboard", Gauge], ["บัญชี", "/accounts", WalletCards], ["ธุรกรรม", "/transactions", ReceiptText],
  ["อัปโหลดและตรวจ", "/upload", Upload], ["เอกสาร", "/documents", FolderOpen], ["งบและเงินกันไว้", "/budgets", PiggyBank],
  ["รายงาน", "/reports", BarChart3], ["ประวัติกิจกรรม", "/activity", Activity], ["ตั้งค่า", "/settings", Settings],
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-background lg:grid lg:grid-cols-[248px_1fr]">
      <a href="#main-content" className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3">ข้ามไปเนื้อหาหลัก</a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r bg-card p-4 lg:flex lg:flex-col">
        <Link href="/dashboard" className="flex min-h-12 items-center gap-3 px-2 text-lg font-bold"><span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Landmark className="size-5" aria-hidden="true" /></span>PocketLedger</Link>
        <nav className="mt-7 space-y-1" aria-label="เมนูหลัก">{navigation.map(([label, href, Icon]) => <Link key={href} href={href} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"><Icon className="size-[18px]" aria-hidden="true" />{label}</Link>)}</nav>
        <div className="mt-auto rounded-xl bg-secondary/70 p-3 text-xs leading-5 text-muted-foreground"><FileSearch className="mb-2 size-5 text-primary" aria-hidden="true" />ยอดเงินมาจากข้อมูลที่คุณบันทึก ไม่ได้เชื่อมต่อธนาคาร</div>
      </aside>
      <div className="min-w-0 lg:col-start-2">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur md:px-7"><div><p className="font-semibold lg:hidden">PocketLedger</p><p className="hidden text-sm text-muted-foreground lg:block">สมุดบัญชีส่วนตัว · เวลาไทย (UTC+7)</p></div><div className="flex items-center gap-1"><ThemeToggle /><form action={signOut}><Button variant="ghost" type="submit">ออกจากระบบ</Button></form></div></header>
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1440px] p-4 pb-24 md:p-7 lg:pb-8">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card/95 px-1 pb-[max(env(safe-area-inset-bottom),4px)] backdrop-blur lg:hidden" aria-label="เมนูมือถือ">
        {navigation.slice(0, 4).map(([label, href, Icon]) => <Link key={href} href={href} className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground"><Icon className="size-5" aria-hidden="true" />{label}</Link>)}
        <Link href="/settings" className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground"><Settings className="size-5" aria-hidden="true" />เพิ่มเติม</Link>
      </nav>
    </div>
  );
}
