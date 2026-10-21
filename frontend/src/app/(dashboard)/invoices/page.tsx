"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { getSocket } from "@/lib/socket";
import {
  formatStoredMoney,
  legacyInvoiceDocument,
} from "@/lib/payment-display";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Invoice } from "@/types";

type PaymentReadiness = {
  checkoutEnabled: boolean;
  qrEnabled: boolean;
  confirmationEnabled: boolean;
  code: string;
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [receiver, setReceiver] = useState("");
  const [canEditSettings, setCanEditSettings] = useState(false);
  const [readiness, setReadiness] = useState<PaymentReadiness | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const [list, status] = await Promise.all([
        api.get("/invoices", { signal }),
        api.get("/invoices/payment-readiness", { signal }),
      ]);
      if (signal?.aborted) return;
      setInvoices(list.data.data);
      setReadiness(status.data.data);
      setError(null);
    } catch {
      if (!signal?.aborted)
        setError(
          "ไม่สามารถโหลดข้อมูลใบเสร็จได้ กรุณาตรวจสิทธิ์และการเชื่อมต่อ",
        );
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    void api
      .get("/auth/me", { signal: controller.signal })
      .then(async ({ data }) => {
        if (controller.signal.aborted) return;
        const permissions: string[] = data.data.permissions;
        setCanEditSettings(permissions.includes("payment-settings.write"));
        if (permissions.includes("payment-settings.read")) {
          const settings = await api.get("/settings/payment", {
            signal: controller.signal,
          });
          if (!controller.signal.aborted)
            setReceiver(settings.data.data.promptPayNumber ?? "");
        }
      })
      .catch(() => {
        /* Settings access is separate from invoice read access. */
      });
    const socket = getSocket();
    const sync = () => {
      void load(controller.signal);
    };
    socket.on("connect", sync);
    socket.on("invoice:new", sync);
    return () => {
      controller.abort();
      socket.off("connect", sync);
      socket.off("invoice:new", sync);
    };
  }, [load]);

  const saveSettings = async () => {
    try {
      await api.post("/settings/payment", {
        promptPayNumber: receiver.trim() || null,
      });
      toast.success(
        "บันทึกข้อมูลผู้รับแล้ว ข้อมูลนี้ยังไม่ใช่การยืนยันบัญชีหรือการรับเงิน",
      );
    } catch (failure: unknown) {
      toast.error(
        (isAxiosError<{ message?: string }>(failure) &&
          failure.response?.data?.message) ||
          "บันทึกไม่ได้",
      );
    }
  };

  const print = () => {
    if (!selected) return;
    const popup = window.open("", "_blank");
    if (!popup) return;
    popup.document.write(legacyInvoiceDocument(selected));
    popup.document.close();
    popup.focus();
    popup.print();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          ใบเสร็จเดิมและการตั้งค่าการชำระเงิน
        </h1>
        <p
          role="status"
          className="mt-2 rounded border border-amber-300 bg-amber-50 p-4"
        >
          ยังไม่เปิด checkout, QR ชำระเงิน หรือการยืนยันรับเงินจริง
          ระหว่างรออนุมัติกติกาโดยร้าน
          ใบเสร็จเดิมไม่ใช่หลักฐานว่าระบบได้ตรวจยืนยันเงินเข้าแล้ว
        </p>
        <Button disabled className="mt-3">
          สร้างใบเสร็จ — รออนุมัติกติกา
        </Button>
        {!readiness && (
          <p className="text-sm text-gray-600">
            ยังไม่ได้รับข้อมูลความพร้อมการชำระเงินจาก server
          </p>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <Card>
        <CardHeader>
          <CardTitle>
            ข้อมูลผู้รับเดิม (ยังไม่ผ่านการยืนยันโดยผู้ให้บริการ)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="receiver">ข้อมูลผู้รับ</Label>
          <Input
            id="receiver"
            value={receiver}
            maxLength={64}
            onChange={(event) => setReceiver(event.target.value)}
            disabled={!canEditSettings}
          />
          <p className="text-sm text-gray-600">
            บันทึกในฐานข้อมูลเท่านั้น ยังไม่ใช้สร้าง QR หรือยืนยันการชำระ
            เว้นว่างเพื่อล้างค่า
          </p>
          <Button
            onClick={() => {
              void saveSettings();
            }}
            disabled={!canEditSettings}
          >
            บันทึกข้อมูลผู้รับ
          </Button>
        </CardContent>
      </Card>
      <Input
        aria-label="ค้นหาใบเสร็จ"
        placeholder="ค้นหาเลขใบเสร็จหรือโต๊ะ"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ใบเสร็จเดิม</TableHead>
            <TableHead>โต๊ะ</TableHead>
            <TableHead>ยอดรวม</TableHead>
            <TableHead>ส่วนลด</TableHead>
            <TableHead>ยอดสุทธิ</TableHead>
            <TableHead>รายละเอียด</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices
            .filter((invoice) =>
              `${invoice.invoiceNumber} ${invoice.session?.table.number ?? ""}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell>
                  INV-{String(invoice.invoiceNumber).padStart(6, "0")}
                </TableCell>
                <TableCell>{invoice.session?.table.number ?? "-"}</TableCell>
                <TableCell>฿{formatStoredMoney(invoice.totalAmount)}</TableCell>
                <TableCell>฿{formatStoredMoney(invoice.discount)}</TableCell>
                <TableCell>฿{formatStoredMoney(invoice.netAmount)}</TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    onClick={() => setSelected(invoice)}
                  >
                    ดู
                  </Button>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ข้อมูลใบเสร็จเดิม</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <p>
                INV-{selected.invoiceNumber} · โต๊ะ{" "}
                {selected.session?.table.number ?? "-"}
              </p>
              <p>ยอดรวม ฿{formatStoredMoney(selected.totalAmount)}</p>
              <p>ส่วนลด ฿{formatStoredMoney(selected.discount)}</p>
              <p>ยอดสุทธิ ฿{formatStoredMoney(selected.netAmount)}</p>
              <p>
                ยังไม่มีหลักฐานยืนยันการรับเงินจริงในข้อมูลเดิม ไม่มี QR
                ชำระเงินสำหรับรายการนี้
              </p>
              <Button onClick={print}>พิมพ์เอกสารเดิม</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
