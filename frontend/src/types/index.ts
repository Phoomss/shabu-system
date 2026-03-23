export interface User {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  isActive: boolean;
  role: { id: number; name: string };
}

export interface Table {
  id: number;
  number: string;
  zone?: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';
}

export interface Tier {
  id: number;
  name: string;
  priceAdult: number;
  priceChild: number;
  timeLimit: number;
}

export interface MenuItem {
  id: string;
  name: string;
  imageUrl?: string;
  isAvailable: boolean;
  category: { id: number; name: string };
  kitchen: { id: number; name: string };
  tierItems: { tier: Tier }[];
}

export interface Session {
  id: string;
  tableId: number;
  table: Table;
  tier: Tier;
  qrToken: string;
  startTime: string;
  endTime: string;
  status: 'ACTIVE' | 'CLOSED' | 'EXPIRED';
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  menuItem: { id: string; name: string; imageUrl?: string };
  kitchen: { id: number; name: string };
  quantity: number;
  status: 'PENDING' | 'PREPARING' | 'SERVED' | 'VOIDED';
}

export interface Order {
  id: string;
  sessionId: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
  items: OrderItem[];
}