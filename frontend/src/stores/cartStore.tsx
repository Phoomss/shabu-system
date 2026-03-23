import { create } from "zustand";

interface CartItem {
  menuItemId: string;
  name: string;
  imageUrl?: string;
  quantity: number;
}

interface CartStore {
  sessionId: string | null;
  items: CartItem[];
  setSessionId: (id: string) => void;
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  sessionId: null,
  items: [],
  setSessionId: (id) => set({ sessionId: id }),
  addItem: (item) => {
    const existing = get().items.find((i) => i.menuItemId === item.menuItemId);
    if (existing) {
      set((state) => ({
        items: state.items.map((i) =>
          i.menuItemId === item.menuItemId
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        ),
      }));
    } else {
      set((state) => ({ items: [...state.items, { ...item, quantity: 1 }] }));
    }
  },
  removeItem: (menuItemId) =>
    set((state) => ({
      items: state.items.filter((i) => i.menuItemId !== menuItemId),
    })),
  updateQuantity: (menuItemId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(menuItemId);
      return;
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.menuItemId === menuItemId ? { ...i, quantity } : i,
      ),
    }));
  },
  clearCart: () => set({ items: [] }),
  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}))