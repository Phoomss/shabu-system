// User & Authentication
export interface User {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  isActive: boolean;
  role: Role;
  refreshToken?: string;
}

export interface Role {
  id: number;
  name: string;
}

// Table & Session Management
export interface Table {
  id: number;
  number: string;
  zone?: string;
  status: TableStatus;
}

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';

export interface Session {
  id: string;
  tableId: number;
  table: Table;
  tierId: number;
  tier: Tier;
  qrToken: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
}

export type SessionStatus = 'ACTIVE' | 'CLOSED' | 'EXPIRED';

// Menu & Kitchen Configuration
export interface KitchenSection {
  id: number;
  name: string;
}

export interface Category {
  id: number;
  name: string;
  iconUrl?: string;
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
  categoryId: number;
  category: Category;
  kitchenId: number;
  kitchen: KitchenSection;
  tierItems: TierMenuItem[];
}

export interface TierMenuItem {
  tierId: number;
  menuItemId: string;
  tier: Tier;
  menuItem: MenuItem;
}

// Ordering System
export interface Order {
  id: string;
  sessionId: string;
  session?: Session;
  status: OrderStatus;
  createdAt: string;
  items: OrderItem[];
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export interface OrderItem {
  id: string;
  orderId: string;
  order?: Order;
  menuItemId: string;
  menuItem: MenuItem;
  kitchenId: number;
  kitchen: KitchenSection;
  quantity: number;
  status: OrderItemStatus;
}

export type OrderItemStatus = 'PENDING' | 'PREPARING' | 'SERVED' | 'VOIDED';

// Inventory & Finance
export interface Ingredient {
  id: number;
  name: string;
  unit: string;
  currentStock: number;
  imageUrl?: string;
  recipes?: Recipe[];
}

export interface Recipe {
  menuItemId: string;
  ingredientId: number;
  quantityUsed: number;
  menuItem?: MenuItem;
  ingredient?: Ingredient;
}

export interface Invoice {
  id: number;
  sessionId: string;
  session?: Session;
  totalAmount: number;
  discount: number;
  netAmount: number;
  paymentMethod: PaymentMethod;
  createdBy: string;
  createdAt: string;
}

export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'QR_CODE' | 'BANK_TRANSFER';

export interface VoidLog {
  id: number;
  orderItemId: string;
  orderItem?: OrderItem;
  reason: string;
  approvedBy: string;
  createdAt: string;
}

// API Response Types
export interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Dashboard & Analytics
export interface DashboardStats {
  totalRevenue: number;
  todayRevenue: number;
  totalOrders: number;
  todayOrders: number;
  activeTables: number;
  totalTables: number;
  lowStockIngredients: number;
}

export interface RevenueReport {
  date: string;
  revenue: number;
  orders: number;
}

// Cart for POS and Customer Ordering
export interface CartItem extends MenuItem {
  quantity: number;
}

// Socket Events Types
export interface SocketEvents {
  // Client -> Server
  'kitchen:join': { kitchenId: number };
  'session:join': { sessionId: string };
  'update-order-item': { orderItemId: string; status: OrderItemStatus };
  'new-order': { sessionId: string; items: { menuItemId: string; kitchenId: number; quantity: number }[] };
  
  // Server -> Client
  'menu:availability_changed': { menuItemId: string; isAvailable: boolean; name: string };
  'kitchen:new_order': { orderId: string; sessionId: string; items: OrderItem[] };
  'kitchen:void_order': { orderItemId: string; orderId: string; reason: string };
  'order:status_changed': Order;
  'order:item_status_changed': { orderItemId: string; orderId: string; menuItem: MenuItem; kitchen: KitchenSection; status: OrderItemStatus };
  'table:status_changed': { tableId: number; status: TableStatus };
  'session:status_changed': { sessionId: string; status: SessionStatus };
  'session:time_warning': { sessionId: string; minutesLeft: number };
  'ingredient:low_stock': { ingredientId: number; name: string; currentStock: number; unit: string; isEmpty: boolean };
  'invoice:new': { invoiceId: number; netAmount: number; paymentMethod: PaymentMethod; tableNumber: string };
}

// Form DTOs
export interface LoginDto {
  username: string;
  password: string;
}

export interface CreateOrderDto {
  sessionId: string;
  items: { menuItemId: string; kitchenId: number; quantity: number }[];
}

export interface UpdateOrderItemStatusDto {
  status: OrderItemStatus;
}

export interface VoidOrderItemDto {
  reason: string;
}

export interface CreateSessionDto {
  tableId: number;
  tierId: number;
}

export interface UpdateSessionStatusDto {
  status: SessionStatus;
}

export interface CreateInvoiceDto {
  sessionId: string;
  discount?: number;
  paymentMethod: PaymentMethod;
}

export interface CreateIngredientDto {
  name: string;
  unit: string;
  currentStock: number;
  imageUrl?: string;
}

export interface UpdateIngredientStockDto {
  currentStock: number;
}

export interface CreateMenuItemDto {
  name: string;
  categoryId: number;
  kitchenId: number;
  imageUrl?: string;
  isAvailable?: boolean;
}

export interface CreateCategoryDto {
  name: string;
  iconUrl?: string;
}

export interface CreateTierDto {
  name: string;
  priceAdult: number;
  priceChild: number;
  timeLimit: number;
}

export interface CreateTableDto {
  number: string;
  zone?: string;
  status?: TableStatus;
}

export interface CreateKitchenSectionDto {
  name: string;
}

export interface CreateRoleDto {
  name: string;
}

export interface CreateUserDto {
  username: string;
  password: string;
  fullName: string;
  roleId: number;
  isActive?: boolean;
}
