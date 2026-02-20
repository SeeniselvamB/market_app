// src/utils/types.ts
// All shared TypeScript interfaces and types

export interface Business {
  name: string;
  owner: string;
  phone: string;
  marketType: 'fruits' | 'vegetables' | 'mixed' | 'custom' | '';
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  pendingAmount: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
}

export interface OrderItem {
  productId: string;
  qty: number;
  delivered: number;
}

export interface Order {
  items: OrderItem[];
  confirmed: boolean;
  orderedAt: string;
}

export interface Bill {
  todayTotal: number;
  prevPending: number;
  grandTotal: number;
  payment: number;
  newPending: number;
  billedAt: string;
}

export interface AppState {
  setup: boolean;
  business: Business;
  customers: Customer[];
  products: Product[];
  todayOrders: Record<string, Order>;
  todayBills: Record<string, Bill>;
}
