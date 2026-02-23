// src/storage/AppContext.tsx
//
// ── STOCK FLOW DESIGN ────────────────────────────────────────
//
// ROLES:
//   A) Normal Customer    — placed in state.customers, generates bills/invoices.
//   B) Delivery Person    — ALWAYS the Business Owner (business.ownerIsDeliveryPerson=true).
//                           A synthetic id OWNER_DP_ID is used for todayOrders and
//                           deliveryPersonStock. No real Customer record needed.
//                           Customers can NEVER be marked as Delivery Person.
//                           No invoice is ever generated for the Delivery Person.
//
// STOCK LOGIC:
// 1. Products have NO persistent default stock.
//    Stock is COMPUTED as the sum of ALL today's orders per product.
//
// 2. Market Purchase List (Dashboard) = ALL orders combined
//    (normal customers + DP order) = what the owner needs to buy from market.
//
// 3. When a DP order is saved (saveOrder):
//    → deliveryPersonStock[dpId][productId] = ordered qty (physical allocation).
//    → No bill/invoice is created.
//
// 4. BILLING VALIDATION (saveBill) — CRITICAL RULE:
//    For each product in a normal customer's bill:
//      originalOrderQty = qty from the customer's saved order
//      deliveredQty     = qty entered during billing confirmation
//      dpStock          = current DP stock for that product
//
//    Case A — deliveredQty <= originalOrderQty:
//      → Deliver freely. NO DP stock check. NO DP stock deduction.
//      → The customer is receiving ≤ what was pre-ordered; stock was pre-allocated.
//
//    Case B — deliveredQty > originalOrderQty:
//      → extraQty = deliveredQty − originalOrderQty
//      → If extraQty > dpStock: BLOCK billing ("Stock Not Available").
//      → Else: Allow billing. Deduct ONLY extraQty from DP stock.
//
//    DP stock is NEVER reduced by the full delivered amount — only by the extra.
//
// 5. DP is BLOCKED from billing entirely (no invoice for DP ever).
//
// 6. On New Day: orders, bills, deliveryPersonStock all reset.
//
// ────────────────────────────────────────────────────────────

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Alert } from 'react-native';
import { AppState, Business, Customer, Product, Order, Bill, OWNER_DP_ID } from '../utils/types';
import { loadState, saveState, getTodayDate, setTodayDate } from './db';
import { uid, getTodayStr } from '../utils/helpers';

// ── Default products (no stock value — stock is order-driven) ─
const DEFAULT_PRODUCTS: Record<string, Omit<Product, 'id'>[]> = {
  fruits: [
    { name: 'Apple',   nameTa: 'ஆப்பிள்',           category: 'Fruits',     unit: 'kg',    price: 120 },
    { name: 'Banana',  nameTa: 'வாழைப்பழம்',         category: 'Fruits',     unit: 'dozen', price: 40  },
    { name: 'Orange',  nameTa: 'ஆரஞ்சு',             category: 'Fruits',     unit: 'kg',    price: 60  },
    { name: 'Mango',   nameTa: 'மாம்பழம்',           category: 'Fruits',     unit: 'kg',    price: 100 },
    { name: 'Grapes',  nameTa: 'திராட்சை',           category: 'Fruits',     unit: 'kg',    price: 80  },
  ],
  vegetables: [
    { name: 'Tomato',   nameTa: 'தக்காளி',           category: 'Vegetables', unit: 'kg', price: 30 },
    { name: 'Onion',    nameTa: 'வெங்காயம்',         category: 'Vegetables', unit: 'kg', price: 25 },
    { name: 'Potato',   nameTa: 'உருளைக்கிழங்கு',   category: 'Vegetables', unit: 'kg', price: 20 },
    { name: 'Capsicum', nameTa: 'குடைமிளகாய்',       category: 'Vegetables', unit: 'kg', price: 50 },
    { name: 'Carrot',   nameTa: 'கேரட்',             category: 'Vegetables', unit: 'kg', price: 40 },
  ],
  mixed: [
    { name: 'Apple',   nameTa: 'ஆப்பிள்',           category: 'Fruits',     unit: 'kg',    price: 120 },
    { name: 'Banana',  nameTa: 'வாழைப்பழம்',         category: 'Fruits',     unit: 'dozen', price: 40  },
    { name: 'Orange',  nameTa: 'ஆரஞ்சு',             category: 'Fruits',     unit: 'kg',    price: 60  },
    { name: 'Tomato',  nameTa: 'தக்காளி',            category: 'Vegetables', unit: 'kg',    price: 30  },
    { name: 'Onion',   nameTa: 'வெங்காயம்',          category: 'Vegetables', unit: 'kg',    price: 25  },
    { name: 'Potato',  nameTa: 'உருளைக்கிழங்கு',    category: 'Vegetables', unit: 'kg',    price: 20  },
  ],
};

const initialState: AppState = {
  setup: false,
  business: { name: 'Market Manager', owner: '', phone: '', marketType: '', ownerIsDeliveryPerson: false },
  customers: [],
  products: [],
  todayOrders: {},
  todayBills: {},
  deliveryPersonStock: {},
};

// ── Compute today's market total per product from all orders ──
function computeMarketTotals(todayOrders: Record<string, Order>): Record<string, number> {
  const totals: Record<string, number> = {};
  Object.values(todayOrders).forEach(order => {
    if (!order?.items) return;
    order.items.forEach(item => {
      if (item.qty > 0) {
        totals[item.productId] = (totals[item.productId] || 0) + item.qty;
      }
    });
  });
  return totals;
}

// ── Resolve the effective Delivery Person ─────────────────────
// Delivery Person is ALWAYS the Business Owner (via ownerIsDeliveryPerson flag).
// Customers can NEVER be marked as Delivery Person.
// Returns undefined if ownerIsDeliveryPerson is not enabled.
function resolveDeliveryPerson(
  business: Business,
  customers: Customer[],
): Customer | undefined {
  if (business.ownerIsDeliveryPerson) {
    return {
      id: OWNER_DP_ID,
      name: business.owner || business.name,
      phone: business.phone,
      address: '',
      pendingAmount: 0,
      isDeliveryPerson: true,
    };
  }
  // Note: customer-level isDeliveryPerson is no longer used.
  // DP must always be configured via business.ownerIsDeliveryPerson.
  return undefined;
}

interface AppContextType {
  state: AppState;
  isLoading: boolean;
  // computed helpers
  getMarketTotals: () => Record<string, number>;
  getDeliveryPersonStock: (dpId: string) => Record<string, number>;
  getPrimaryDeliveryPerson: () => Customer | undefined;
  calculateOrderTotal: (customerId: string) => number;
  // mutations
  saveBusiness: (biz: Business) => Promise<void>;
  finishSetup: () => Promise<void>;
  addCustomer: (c: Omit<Customer, 'id'>) => Promise<void>;
  updateCustomer: (id: string, c: Omit<Customer, 'id'>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  addProduct: (p: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (id: string, p: Omit<Product, 'id'>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  autoPopulateProducts: (marketType: string) => void;
  saveOrder: (customerId: string, order: Order) => Promise<void>;
  saveBill: (customerId: string, bill: Bill, deliveredQtys: Record<string, number>) => Promise<boolean>;
  startNewDay: () => Promise<void>;
  clearTodayData: () => Promise<void>;
  resetAllData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [isLoading, setIsLoading] = useState(true);

  const persist = useCallback(async (newState: AppState) => {
    setState(newState);
    await saveState(newState);
  }, []);

  // ── Boot ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const saved = await loadState();
      if (saved) {
        const migratedState: AppState = {
          ...initialState,
          ...saved,
          business: {
            ...initialState.business,
            ...(saved.business || {}),
            // Migrate: ensure ownerIsDeliveryPerson exists
            ownerIsDeliveryPerson: saved.business?.ownerIsDeliveryPerson ?? false,
          },
          deliveryPersonStock: saved.deliveryPersonStock || {},
          products: (saved.products || []).map((p: any) => {
            const { stock, ...rest } = p;
            return rest as Product;
          }),
          customers: (saved.customers || []).map((c: any) => c as Customer),
        };
        const savedDate = await getTodayDate();
        const today = getTodayStr();
        if (savedDate !== today) {
          const updatedCustomers = migratedState.customers.map((c: Customer) => {
            const bill = migratedState.todayBills[c.id];
            return bill ? { ...c, pendingAmount: bill.newPending } : c;
          });
          await persist({
            ...migratedState,
            customers: updatedCustomers,
            todayOrders: {},
            todayBills: {},
            deliveryPersonStock: {},
          });
          await setTodayDate(today);
        } else {
          setState(migratedState);
        }
      }
      setIsLoading(false);
    })();
  }, [persist]);

  // ── Computed helpers ─────────────────────────────────────
  const getMarketTotals = () => computeMarketTotals(state.todayOrders);
  const getDeliveryPersonStock = (dpId: string) => state.deliveryPersonStock[dpId] || {};
  const getPrimaryDeliveryPerson = () => resolveDeliveryPerson(state.business, state.customers);

  const calculateOrderTotal = (customerId: string): number => {
    const order = state.todayOrders[customerId];
    if (!order?.items) return 0;
    return order.items.reduce((sum, item) => {
      const p = state.products.find(x => x.id === item.productId);
      return sum + (p ? (item.delivered ?? item.qty) * p.price : 0);
    }, 0);
  };

  // ── Business ──────────────────────────────────────────────
  const saveBusiness = async (biz: Business) => { await persist({ ...state, business: biz }); };
  const finishSetup  = async () => {
    await persist({ ...state, setup: true });
    await setTodayDate(getTodayStr());
  };

  // ── Customers ─────────────────────────────────────────────
  const addCustomer = async (c: Omit<Customer, 'id'>) => {
    await persist({ ...state, customers: [...state.customers, { id: uid(), ...c }] });
  };
  const updateCustomer = async (id: string, c: Omit<Customer, 'id'>) => {
    await persist({ ...state, customers: state.customers.map(x => x.id === id ? { ...x, ...c } : x) });
  };
  const deleteCustomer = async (id: string) => {
    const todayOrders = { ...state.todayOrders };
    const todayBills  = { ...state.todayBills };
    const deliveryPersonStock = { ...state.deliveryPersonStock };
    delete todayOrders[id]; delete todayBills[id]; delete deliveryPersonStock[id];
    await persist({
      ...state,
      customers: state.customers.filter(x => x.id !== id),
      todayOrders, todayBills, deliveryPersonStock,
    });
  };

  // ── Products ──────────────────────────────────────────────
  const addProduct = async (p: Omit<Product, 'id'>) => {
    await persist({ ...state, products: [...state.products, { id: uid(), ...p }] });
  };
  const updateProduct = async (id: string, p: Omit<Product, 'id'>) => {
    await persist({ ...state, products: state.products.map(x => x.id === id ? { ...x, ...p } : x) });
  };
  const deleteProduct = async (id: string) => {
    await persist({ ...state, products: state.products.filter(x => x.id !== id) });
  };
  const autoPopulateProducts = (marketType: string) => {
    const defaults = DEFAULT_PRODUCTS[marketType] || [];
    const existing = new Set(state.products.map(p => p.name));
    const toAdd = defaults.filter(p => !existing.has(p.name)).map(p => ({ id: uid(), ...p }));
    setState(prev => ({ ...prev, products: [...prev.products, ...toAdd] }));
  };

  // ── Save Order ────────────────────────────────────────────
  // For ALL customers (normal + DP):
  //   - Save the order into todayOrders (contributes to Market Purchase List)
  //   - Clear any existing bill for this customer
  //
  // For Delivery Person (including Owner DP via OWNER_DP_ID):
  //   - SET their deliveryPersonStock to ordered quantities (physical allocation)
  //   - No bill record is created for DP
  const saveOrder = async (customerId: string, order: Order) => {
    const customer = state.customers.find(c => c.id === customerId);
    const isOwnerDp = customerId === OWNER_DP_ID;
    const isDp = isOwnerDp || customer?.isDeliveryPerson;

    const todayOrders = { ...state.todayOrders, [customerId]: order };
    const todayBills  = { ...state.todayBills };
    // Clear any old bill for this entry (customers only — DP has no bill)
    if (!isDp) delete todayBills[customerId];

    let newDeliveryPersonStock = { ...state.deliveryPersonStock };

    if (isDp) {
      // Build DP's stock allocation from scratch based on this order
      const dpStock: Record<string, number> = {};
      order.items.forEach(item => {
        if (item.qty > 0) dpStock[item.productId] = item.qty;
      });
      newDeliveryPersonStock[customerId] = dpStock;
    }

    await persist({ ...state, todayOrders, todayBills, deliveryPersonStock: newDeliveryPersonStock });
  };

  // ── Save Bill ─────────────────────────────────────────────
  // DELIVERY PERSON IS NEVER BILLED — blocked immediately.
  //
  // For NORMAL CUSTOMERS, the three-way stock adjustment logic is:
  //
  //   originalOrderQty = item.qty from the saved order
  //   deliveredQty     = qty confirmed during billing
  //   dpStock          = DP's current stock for this product
  //
  //   deliveredQty > originalOrderQty  → EXTRA delivery
  //     extraQty = deliveredQty - originalOrderQty
  //     If extraQty > dpStock: BLOCK ("Stock Not Available")
  //     Else: DEDUCT extraQty from DP stock
  //
  //   deliveredQty < originalOrderQty  → PARTIAL delivery (return)
  //     returnQty = originalOrderQty - deliveredQty
  //     ADD returnQty back to DP stock (undelivered stock returns to DP)
  //
  //   deliveredQty == originalOrderQty → No DP stock change
  //
  // RE-BILLING (editing an existing bill):
  //   Before applying the new adjustment, the previous bill's stock effect
  //   is fully REVERSED so we start from a clean baseline each time.
  //
  //   Previous effect reversal:
  //     prev extra   → was deducted  → ADD it back first
  //     prev return  → was added     → DEDUCT it back first
  const saveBill = async (
    customerId: string,
    bill: Bill,
    deliveredQtys: Record<string, number>,
  ): Promise<boolean> => {
    const order    = state.todayOrders[customerId];
    const customer = state.customers.find(c => c.id === customerId);
    if (!order || !customer) return false;

    // ── HARD BLOCK: DP cannot be billed ───────────────────
    const isOwnerDp = customerId === OWNER_DP_ID;
    if (isOwnerDp || customer.isDeliveryPerson) {
      Alert.alert(
        'Not Allowed',
        'The Delivery Person is a stock handler — no invoice is generated for them.',
      );
      return false;
    }

    const newDpStock = { ...state.deliveryPersonStock };
    const dp = resolveDeliveryPerson(state.business, state.customers);

    if (dp) {
      const dpStock = { ...(newDpStock[dp.id] || {}) };

      // ── Step 1: Reverse previous bill's stock effect (re-billing support) ──
      // If this customer already has a saved bill, undo its stock impact
      // so we apply a fresh adjustment based on the new delivered quantities.
      const prevBill = state.todayBills[customerId];
      if (prevBill) {
        order.items.forEach(item => {
          const productId        = item.productId;
          const originalOrderQty = item.qty;
          const prevDelivered    = item.delivered ?? originalOrderQty;

          if (prevDelivered > originalOrderQty) {
            // Previous bill had deducted extraQty — restore it
            const prevExtra = prevDelivered - originalOrderQty;
            dpStock[productId] = (dpStock[productId] || 0) + prevExtra;
          } else if (prevDelivered < originalOrderQty) {
            // Previous bill had added returnQty back — remove it
            const prevReturn = originalOrderQty - prevDelivered;
            dpStock[productId] = Math.max(0, (dpStock[productId] || 0) - prevReturn);
          }
          // prevDelivered == originalOrderQty → no previous stock change, nothing to undo
        });
      }

      // ── Step 2: Validate — block only if extra qty exceeds DP stock ──
      for (const item of order.items) {
        const productId        = item.productId;
        const originalOrderQty = item.qty;
        const deliveredQty     = deliveredQtys[productId] ?? 0;

        if (deliveredQty <= originalOrderQty) {
          // Delivering ≤ ordered: no DP stock check needed
          // (partial delivery returns stock to DP — always valid)
          continue;
        }

        // Delivering MORE than ordered — verify DP has enough extra stock
        const extraQty  = deliveredQty - originalOrderQty;
        const available = dpStock[productId] || 0;
        const prod      = state.products.find(p => p.id === productId);

        if (extraQty > available) {
          Alert.alert(
            'Stock Not Available',
            `${prod?.name || 'Product'}: Ordered ${originalOrderQty} ${prod?.unit || ''}, ` +
            `delivering ${deliveredQty} ${prod?.unit || ''} (${extraQty} extra needed). ` +
            `Delivery person only has ${available} ${prod?.unit || ''} available.`,
          );
          return false;
        }
      }

      // ── Step 3: Apply three-way stock adjustment ──────────
      // Extra delivery  → deduct extraQty from DP stock
      // Partial delivery → add returnQty back to DP stock
      // Exact delivery  → no change
      order.items.forEach(item => {
        const productId        = item.productId;
        const originalOrderQty = item.qty;
        const deliveredQty     = deliveredQtys[productId] ?? 0;

        if (deliveredQty > originalOrderQty) {
          // Extra delivery: deduct only the extra from DP stock
          const extraQty = deliveredQty - originalOrderQty;
          dpStock[productId] = Math.max(0, (dpStock[productId] || 0) - extraQty);
        } else if (deliveredQty < originalOrderQty) {
          // Partial delivery: undelivered stock returns to DP
          const returnQty = originalOrderQty - deliveredQty;
          dpStock[productId] = (dpStock[productId] || 0) + returnQty;
        }
        // deliveredQty === originalOrderQty: no DP stock adjustment

        // Record the actual delivered quantity on the order item
        item.delivered = deliveredQty;
      });

      newDpStock[dp.id] = dpStock;
    } else {
      // No DP configured — save bill without any stock check or adjustment
      order.items.forEach(item => {
        item.delivered = deliveredQtys[item.productId] ?? 0;
      });
    }

    await persist({
      ...state,
      deliveryPersonStock: newDpStock,
      todayBills: { ...state.todayBills, [customerId]: bill },
    });
    return true;
  };

  // ── Day management ────────────────────────────────────────
  const startNewDay = async () => {
    const updatedCustomers = state.customers.map(c => {
      const bill = state.todayBills[c.id];
      return bill ? { ...c, pendingAmount: bill.newPending } : c;
    });
    await persist({
      ...state,
      customers: updatedCustomers,
      todayOrders: {},
      todayBills: {},
      deliveryPersonStock: {},
    });
    await setTodayDate(getTodayStr());
  };

  const clearTodayData = async () => {
    await persist({ ...state, todayOrders: {}, todayBills: {}, deliveryPersonStock: {} });
  };

  const resetAllData = async () => {
    await persist(initialState);
    await setTodayDate('');
  };

  return (
    <AppContext.Provider value={{
      state, isLoading,
      getMarketTotals, getDeliveryPersonStock, getPrimaryDeliveryPerson, calculateOrderTotal,
      saveBusiness, finishSetup,
      addCustomer, updateCustomer, deleteCustomer,
      addProduct, updateProduct, deleteProduct, autoPopulateProducts,
      saveOrder, saveBill,
      startNewDay, clearTodayData, resetAllData,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
