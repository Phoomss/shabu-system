import type { Invoice } from "@/types";

/** Display stored decimal strings without binary arithmetic or silently rounding historical money. */
export function formatStoredMoney(value: unknown): string {
  const text =
    typeof value === "string" || typeof value === "number" ? String(value) : "";
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return "ไม่ระบุ";
  const integer = match[2]
    .replace(/^0+(?=\d)/, "")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = (match[3] || "").replace(/0+$/, "").padEnd(2, "0");
  return `${match[1]}${integer}.${fraction}`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}

export function legacyInvoiceDocument(invoice: Invoice): string {
  return `<!doctype html><html lang="th"><meta charset="utf-8"><title>เอกสารใบเสร็จเดิม ${escapeHtml(invoice.invoiceNumber)}</title>
  <body><h1>เอกสารใบเสร็จเดิม ${escapeHtml(invoice.invoiceNumber)}</h1>
  <p>เอกสารเดิมยังไม่ใช่หลักฐานยืนยันรับเงินจริงจากระบบ ไม่มี payment confirmation policy ที่อนุมัติ</p>
  <p>โต๊ะ ${escapeHtml(invoice.session?.table.number)} — ${escapeHtml(invoice.createdAt)}</p>
  <p>ยอดรวม ฿${formatStoredMoney(invoice.totalAmount)}</p><p>ส่วนลด ฿${formatStoredMoney(invoice.discount)}</p>
  <p>ยอดสุทธิ ฿${formatStoredMoney(invoice.netAmount)}</p>
  <p>แสดงยอดที่บันทึกไว้ ไม่คำนวณใหม่จากราคาแพ็กเกจปัจจุบัน ไม่สร้าง QR ชำระเงิน</p></body></html>`;
}
