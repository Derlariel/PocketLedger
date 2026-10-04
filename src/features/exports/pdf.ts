import { readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { getBank, maskLastFour } from "@/features/accounts/banks";
import { minorToDecimal } from "@/features/exports/csv";
import { exportSummary, ledgerKey, transactionDelta, type ExportAccount, type ExportData, type ExportTransaction } from "@/features/exports/model";

const GREEN = "#176b4d";
const INK = "#26211d";
const MUTED = "#6f675f";
const LINE = "#ded8d1";
const SOFT = "#f5f2ed";
const PAGE_MARGIN = 34;
// Keep the footer inside PDFKit's printable area; drawing below it auto-adds pages.
const FOOTER_Y = 535;

export async function generatePdf(data: ExportData) {
  const font = await readFile(path.join(process.cwd(), "src", "assets", "fonts", "NotoSansThai.ttf"));
  const logoByBank = new Map<string, Buffer>();
  await Promise.all(data.accounts.map(async (account) => {
    const bank = getBank(account.bankId);
    if (!bank || logoByBank.has(bank.id)) return;
    try {
      const source = path.join(process.cwd(), "public", bank.logoPath.replace(/^\//, ""));
      logoByBank.set(bank.id, await sharp(source).resize(96, 96, { fit: "contain", background: "#ffffff" }).png().toBuffer());
    } catch { /* The visible bank name remains as the clean fallback. */ }
  }));

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margins: { top: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 48 }, bufferPages: true, info: { Title: "PocketLedger Financial Report", Author: "PocketLedger" } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.registerFont("Noto", font);
    doc.font("Noto");

    drawReportHeader(doc, data, logoByBank);
    const selectedAccountId = data.filter.accountId === "all" ? null : data.filter.accountId;
    if (selectedAccountId) {
      const account = data.accounts.find((item) => item.id === selectedAccountId);
      if (account) drawAccountSection(doc, data, account, data.transactions, logoByBank.get(account.bankId ?? ""));
    } else {
      for (const account of data.accounts) {
        const transactions = data.transactions.filter((transaction) => transaction.accountId === account.id || transaction.counterAccountId === account.id);
        drawAccountSection(doc, data, account, transactions, logoByBank.get(account.bankId ?? ""));
      }
    }
    drawCategorySummary(doc, data, selectedAccountId);

    const pages = doc.bufferedPageRange();
    for (let index = pages.start; index < pages.start + pages.count; index++) {
      doc.switchToPage(index);
      doc.font("Noto").fontSize(7).fillColor(MUTED);
      doc.text(`PocketLedger | Generated ${formatDateTime(data.generatedAt)}`, PAGE_MARGIN, FOOTER_Y, { width: 600, lineBreak: false });
      doc.text(`Page ${index - pages.start + 1} of ${pages.count}`, 700, FOOTER_Y, { width: 105, align: "right", lineBreak: false });
    }
    doc.end();
  });
}

function drawReportHeader(doc: PDFKit.PDFDocument, data: ExportData, logos: Map<string, Buffer>) {
  doc.fillColor(GREEN).fontSize(22).text("PocketLedger Financial Report", PAGE_MARGIN, 32);
  doc.fillColor(MUTED).fontSize(9).text(`Reporting period: ${periodLabel(data)} | Generated: ${formatDateTime(data.generatedAt)} | Timezone: Asia/Bangkok`, PAGE_MARGIN, 63);
  doc.text(`Format currency: THB | Exported transactions: ${data.transactions.length}`, PAGE_MARGIN, 80);
  if (data.accounts.length === 1) {
    const account = data.accounts[0]; const bank = getBank(account.bankId);
    const logo = bank ? logos.get(bank.id) : undefined;
    if (logo) doc.image(logo, 710, 30, { width: 46, height: 46, fit: [46, 46] });
    doc.fillColor(INK).fontSize(11).text(account.name, 575, 34, { width: 125, align: "right" });
    doc.fillColor(MUTED).fontSize(8).text(bank?.name ?? "Manual account", 545, 52, { width: 155, align: "right" });
    doc.text(maskLastFour(account.lastFour), 575, 67, { width: 125, align: "right" });
  }
  doc.moveTo(PAGE_MARGIN, 98).lineTo(808, 98).strokeColor(LINE).stroke();
  doc.y = 112;
}

function drawAccountSection(doc: PDFKit.PDFDocument, data: ExportData, account: ExportAccount, transactions: ExportTransaction[], logo?: Buffer) {
  ensureSpace(doc, 120);
  if (logo) doc.image(logo, PAGE_MARGIN, doc.y, { width: 34, height: 34, fit: [34, 34] });
  const x = logo ? PAGE_MARGIN + 44 : PAGE_MARGIN;
  doc.fillColor(INK).fontSize(14).text(account.name, x, doc.y, { width: 390 });
  const bank = getBank(account.bankId);
  doc.fillColor(MUTED).fontSize(8).text(`${bank?.name ?? "Manual account"} | ${maskLastFour(account.lastFour)} | ${account.currency}`, x, doc.y + 2, { width: 500 });
  doc.moveDown(1.2);

  const summary = exportSummary({ ...data, transactions }, account.id);
  const items = [
    ["Opening balance", account.openingAtPeriod], ["Total income", summary.income], ["Total expenses", summary.expenses],
    ["Net cash flow", summary.net], ["Closing balance", account.closingAtPeriod], ["Available now", account.availableBalance],
  ] as const;
  const y = doc.y + 8; const width = 124;
  items.forEach(([label, value], index) => {
    const boxX = PAGE_MARGIN + index * 128;
    doc.roundedRect(boxX, y, width, 48, 5).fill(SOFT);
    doc.fillColor(MUTED).fontSize(7).text(label, boxX + 8, y + 8, { width: width - 16 });
    doc.fillColor(INK).fontSize(11).text(formatMoney(value), boxX + 8, y + 24, { width: width - 16 });
  });
  doc.y = y + 61;
  drawTransactionTable(doc, data, account, transactions);
  doc.moveDown(1.2);
}

function drawTransactionTable(doc: PDFKit.PDFDocument, data: ExportData, account: ExportAccount, transactions: ExportTransaction[]) {
  const columns = data.filter.includeNotes
    ? [["Date", 62], ["Description", 104], ["Type", 50], ["Category", 65], ["Account", 72], ["In", 54], ["Out", 54], ["Balance", 62], ["Status", 46], ["Notes", 105]] as const
    : [["Date", 70], ["Description", 145], ["Type", 55], ["Category", 80], ["Account", 90], ["In", 62], ["Out", 62], ["Balance", 72], ["Status", 55]] as const;
  const header = (y: number) => {
    let x = PAGE_MARGIN;
    doc.rect(PAGE_MARGIN, y, columns.reduce((sum, column) => sum + column[1], 0), 20).fill(GREEN);
    doc.fillColor("#ffffff").fontSize(7);
    for (const [label, width] of columns) { doc.text(label, x + 4, y + 6, { width: width - 8, lineBreak: false }); x += width; }
    return y + 20;
  };
  let cursorY = header(doc.y);
  if (!transactions.length) {
    doc.fillColor(MUTED).fontSize(8).text("No matching transactions for this account.", PAGE_MARGIN + 6, cursorY + 10);
    doc.x = PAGE_MARGIN; doc.y = cursorY + 34; return;
  }
  for (const [rowIndex, transaction] of transactions.entries()) {
    const delta = transactionDelta(transaction, account.id, data.ledgerByTransactionAccount);
    const running = data.ledgerByTransactionAccount.get(ledgerKey(transaction.id, account.id))?.running;
    const cells = [
      formatDateTime(new Date(transaction.occurredAt)), transaction.description, transaction.type,
      transaction.categories.map((category) => category.name).join(", ") || "-", account.name,
      delta > 0n ? formatMoney(delta) : "-", delta < 0n ? formatMoney(-delta) : "-", running === undefined ? "-" : formatMoney(running), transaction.status,
      ...(data.filter.includeNotes ? [transaction.note ?? "-"] : []),
    ];
    doc.font("Noto").fontSize(7);
    const heights = cells.map((cell, index) => doc.heightOfString(cell, { width: columns[index][1] - 8, lineGap: 1 }));
    const height = Math.max(22, Math.min(54, Math.max(...heights) + 8));
    if (cursorY + height > FOOTER_Y - 10) { doc.addPage(); cursorY = header(PAGE_MARGIN); }
    let x = PAGE_MARGIN; const y = cursorY;
    doc.rect(PAGE_MARGIN, y, columns.reduce((sum, column) => sum + column[1], 0), height).fill(rowIndex % 2 ? "#faf8f5" : "#ffffff");
    doc.fillColor(INK).fontSize(7);
    cells.forEach((cell, index) => { const width = columns[index][1]; doc.text(cell, x + 4, y + 5, { width: width - 8, height: height - 8, ellipsis: true, lineGap: 1 }); x += width; });
    doc.moveTo(PAGE_MARGIN, y + height).lineTo(x, y + height).strokeColor(LINE).lineWidth(0.4).stroke();
    cursorY = y + height;
  }
  doc.x = PAGE_MARGIN;
  doc.y = cursorY;
}

function drawCategorySummary(doc: PDFKit.PDFDocument, data: ExportData, accountId: string | null) {
  const summary = exportSummary(data, accountId);
  ensureSpace(doc, 80);
  doc.fillColor(INK).fontSize(12).text("Summary by category");
  doc.moveDown(0.4);
  if (!summary.categories.length) { doc.fillColor(MUTED).fontSize(8).text("No categorized transactions in this export."); return; }
  for (const [name, amount] of summary.categories) {
    ensureSpace(doc, 18);
    doc.fillColor(INK).fontSize(8).text(name, PAGE_MARGIN, doc.y, { width: 300 });
    doc.text(formatMoney(amount), 340, doc.y, { width: 120, align: "right" });
    doc.moveDown(0.6);
  }
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > FOOTER_Y - 10) { doc.addPage(); doc.y = PAGE_MARGIN; }
}

function formatMoney(value: bigint) {
  return `${value < 0n ? "-" : ""}THB ${minorToDecimal(value < 0n ? -value : value)}`;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }).format(date);
}

function periodLabel(data: ExportData) {
  if (!data.fromDate && !data.toDate) return "All time";
  return `${data.fromDate ?? "Beginning"} to ${data.toDate ?? "Present"}`;
}
