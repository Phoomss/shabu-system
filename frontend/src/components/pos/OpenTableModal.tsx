'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import api from '@/lib/api';
import { Table, Tier } from '@/types';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Clock, QrCode } from 'lucide-react';

interface Props {
  table: Table;
  tiers: Tier[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function OpenTableModal({ table, tiers, onClose, onSuccess }: Props) {
  const [tierId, setTierId] = useState<string>('');
  const [adultCount, setAdultCount] = useState(2);
  const [childCount, setChildCount] = useState(0);
  const [qrToken, setQrToken] = useState<string | null>(null);

  const selectedTier = tiers.find((t) => t.id === Number(tierId));

  const totalPrice = selectedTier
    ? selectedTier.priceAdult * adultCount + selectedTier.priceChild * childCount
    : 0;

  const { mutate: openTable, isPending } = useMutation({
    mutationFn: async () => {
      const res = await api.post('/sessions', {
        tableId: table.id,
        tierId: Number(tierId),
        adultCount,
        childCount,
      });
      return res.data.data;
    },
    onSuccess: (session) => {
      setQrToken(session.qrToken);
      toast.success(`เปิดโต๊ะ ${table.number} สำเร็จ`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message ?? 'เปิดโต๊ะไม่สำเร็จ');
    },
  });

  // หลังจาก QR แสดงแล้ว กด confirm
  const handleConfirm = () => {
    onSuccess();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>เปิดโต๊ะ</span>
            <Badge variant="outline" className="text-base font-bold">
              {table.number}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {!qrToken ? (
          // ── Form เปิดโต๊ะ ──
          <div className="space-y-4 py-2">
            {/* เลือก Tier */}
            <div className="space-y-1.5">
              <Label>ระดับราคา (Tier)</Label>
              <Select value={tierId} onValueChange={setTierId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกระดับราคา" />
                </SelectTrigger>
                <SelectContent>
                  {tiers.map((tier) => (
                    <SelectItem key={tier.id} value={String(tier.id)}>
                      <div className="flex items-center justify-between gap-4">
                        <span>{tier.name}</span>
                        <span className="text-gray-400 text-xs">
                          ผู้ใหญ่ ฿{tier.priceAdult} / เด็ก ฿{tier.priceChild}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* จำนวนลูกค้า */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Users size={14} /> ผู้ใหญ่
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={adultCount}
                  onChange={(e) => setAdultCount(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Users size={14} /> เด็ก
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={childCount}
                  onChange={(e) => setChildCount(Number(e.target.value))}
                />
              </div>
            </div>

            {/* สรุปราคา */}
            {selectedTier && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1">
                    <Clock size={13} /> เวลา
                  </span>
                  <span>{selectedTier.timeLimit} นาที</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">ผู้ใหญ่ {adultCount} คน</span>
                  <span>฿{(selectedTier.priceAdult * adultCount).toLocaleString()}</span>
                </div>
                {childCount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">เด็ก {childCount} คน</span>
                    <span>฿{(selectedTier.priceChild * childCount).toLocaleString()}</span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>รวม</span>
                  <span className="text-red-600">฿{totalPrice.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          // ── แสดง QR Code ──
          <div className="flex flex-col items-center py-4 space-y-4">
            <p className="text-sm text-gray-500">สแกน QR เพื่อสั่งอาหาร</p>
            <div className="bg-white p-4 rounded-xl border-2 border-gray-100 shadow-sm">
              <QRCodeSVG
                value={`${process.env.NEXT_PUBLIC_APP_URL}/order/${qrToken}`}
                size={200}
                level="H"
              />
            </div>
            <p className="text-xs text-gray-400 font-mono bg-gray-50 px-3 py-1.5 rounded-lg">
              {qrToken}
            </p>
          </div>
        )}

        <DialogFooter>
          {!qrToken ? (
            <>
              <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                disabled={!tierId || adultCount < 1 || isPending}
                onClick={() => openTable()}
              >
                {isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />กำลังเปิดโต๊ะ...</>
                ) : (
                  <><QrCode size={16} className="mr-2" />เปิดโต๊ะ</>
                )}
              </Button>
            </>
          ) : (
            <Button
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={handleConfirm}
            >
              ยืนยัน — กลับสู่ผังโต๊ะ
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}