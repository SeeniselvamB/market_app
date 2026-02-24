// src/utils/types.ts
// All shared TypeScript interfaces and types

export interface Business {
  name: string;
  owner: string;
  phone: string;
  marketType: 'fruits' | 'vegetables' | 'mixed' | 'custom' | '';
  // When true, the Business Owner acts as the Delivery Person.
  // A synthetic entry with id = OWNER_DP_ID is used to track their stock & orders.
  ownerIsDeliveryPerson?: boolean;
}

// Synthetic ID used when the Business Owner is the Delivery Person.
// This ID is never a real Customer — exists only in todayOrders / deliveryPersonStock.
export const OWNER_DP_ID = '__owner_dp__';

export interface Customer {
  id: string;
  name: string;
  nameTa?: string;          // Tamil name (optional)
  phone: string;
  address: string;
  pendingAmount: number;
  isDeliveryPerson?: boolean;
}

export interface Product {
  id: string;
  name: string;
  nameTa?: string;          // Tamil name (optional)
  category: string;
  unit: string;
  price: number;
  // NOTE: stock is NOT a persistent default. It is always computed at runtime
  // as the sum of all today's confirmed orders for this product (the market
  // purchase total). We store it only for migration compatibility.
}

export interface DeliveryPersonStock {
  // deliveryPersonId → { productId → remainingQty }
  [deliveryPersonId: string]: {
    [productId: string]: number;
  };
}

export interface OrderItem {
  productId: string;
  qty: number;       // qty ordered
  delivered: number; // qty actually delivered (filled at billing time)
  unit?: string;     // unit at time of order (for display)
}

export interface Order {
  items: OrderItem[];
  confirmed: boolean;
  orderedAt: string;
}

export interface Bill {
  todayTotal: number;
  prevPending: number;
  charge: number;       // Vehicle / delivery expense charge
  grandTotal: number;   // todayTotal + charge (prevPending tracked separately)
  payment: number;
  newPending: number;
  billedAt: string;
}

export const UNIT_OPTIONS = ['kg', 'piece', 'dozen', 'box', 'unit'] as const;

export interface AppState {
  setup: boolean;
  business: Business;
  customers: Customer[];
  products: Product[];
  todayOrders: Record<string, Order>;
  todayBills: Record<string, Bill>;
  // deliveryPersonStock[dpId][productId] = remaining qty assigned to that delivery person today
  deliveryPersonStock: DeliveryPersonStock;
}
