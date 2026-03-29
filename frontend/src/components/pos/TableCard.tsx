import { Table } from '@/types';
import { cn } from '@/lib/utils';
import { Users } from 'lucide-react';

interface Props {
  table: Table;
  onClick: () => void;
}

const statusConfig = {
  AVAILABLE: {
    bg: 'bg-green-50 border-green-200 hover:bg-green-100',
    badge: 'bg-green-500',
    label: 'ว่าง',
    textColor: 'text-green-700',
  },
  OCCUPIED: {
    bg: 'bg-red-50 border-red-200 hover:bg-red-100',
    badge: 'bg-red-500',
    label: 'มีลูกค้า',
    textColor: 'text-red-700',
  },
  CLEANING: {
    bg: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100',
    badge: 'bg-yellow-500',
    label: 'รอทำความสะอาด',
    textColor: 'text-yellow-700',
  },
  RESERVED: {
    bg: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    badge: 'bg-blue-500',
    label: 'จองแล้ว',
    textColor: 'text-blue-700',
  },
};

export default function TableCard({ table, onClick }: Props) {
  const config = statusConfig[table.status];

  return (
    <button
      onClick={onClick}
      className={cn(
        'border-2 rounded-xl p-4 text-left transition-all duration-200 cursor-pointer w-full',
        config.bg,
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xl font-bold">{table.number}</span>
        <span className={cn('w-2.5 h-2.5 rounded-full mt-1', config.badge)} />
      </div>
      <div className="flex items-center gap-1">
        <Users size={12} className={config.textColor} />
        <span className={cn('text-xs font-medium', config.textColor)}>
          {config.label}
        </span>
      </div>
    </button>
  );
}