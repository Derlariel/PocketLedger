"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatSatangs } from "@/features/ledger/money";

export function CashflowChart({ income, expense }: { income: string; expense: string }) {
  const data = [{ name: "เดือนนี้", income: Number(BigInt(income) / 100n), expense: Number(BigInt(expense) / 100n) }];
  return <div className="h-64 w-full" role="img" aria-label={`รายรับ ${formatSatangs(income)} รายจ่าย ${formatSatangs(expense)}`}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" tickLine={false} axisLine={false} /><YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} width={36} /><Tooltip formatter={(value) => `฿${Number(value).toLocaleString("th-TH")}`} /><Bar dataKey="income" name="รายรับ" fill="var(--primary)" radius={[8, 8, 0, 0]} /><Bar dataKey="expense" name="รายจ่าย" fill="var(--destructive)" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>;
}
