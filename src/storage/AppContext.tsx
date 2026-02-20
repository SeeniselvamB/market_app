// src/storage/AppContext.tsx
// React Context that holds the global AppState.
// All screens read from and write to this context.
// Persists every change to AsyncStorage automatically.

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { AppState, Business, Customer, Product, Order, Bill } from '../utils/types';
import { loadState, saveState, getTodayDate, setTodayDate } from './db';
import { uid, getTodayStr } from '../utils/helpers';

// ── Default products per market type ────────────────────────
const DEFAULT_PRODUCTS: Record<string, Omit<Product, 'id'>[]> = {
  fruits: [
    { name: 'Apple',   category: 'Fruits', unit: 'kg',    price: 120 },
    { name: 'Banana',  category: 'Fruits', unit: 'dozen', price: 40  },
    { name: 'Orange',  category: 'Fruits', unit: 'kg',    price: 60  },
    { name: 'Mango',   category: 'Fruits', unit: 'kg',    price: 100 },
    { name: 'Grapes',  category: 'Fruits', unit: 'kg',    price: 80  },
  ],
  vegetables: [
    { name: 'Tomato',   category: 'Vegetables', unit: 'kg', price: 30 },
    { name: 'Onion',    category: 'Vegetables', unit: 'kg', price: 25 },
    { name: 'Potato',   category: 'Vegetables', unit: 'kg', price: 20 },
    { name: 'Capsicum', category: 'Vegetables', unit: 'kg', price: 50 },
    { name: 'Carrot',   category: 'Vegetables', unit: 'kg', price: 40 },
  ],
  mixed: [
    { name: 'Apple',   category: 'Fruits',      unit: 'kg',    price: 120 },
    { name: 'Banana',  category: 'Fruits',      unit: 'dozen', price: 40  },
    { name: 'Orange',  category: 'Fruits',      unit: 'kg',    price: 60  },
    { name: 'Tomato',  category: 'Vegetables',  unit: 'kg',    price: 30  },
    { name: 'Onion',   category: 'Vegetables',  unit: 'kg',    price: 25  },
    { name: 'Potato',  category: 'Vegetables',  unit: 'kg',    price: 20  },
  ],
};

// ── Initial state ────────────────────────────────────────────
const initialState: AppState = {
  setup: false,
  business: { name: 'Market Manager', owner: '', phone: '', marketType: '' },
  customers: [],
  products: [],
  todayOrders: {},
  todayBills: {},
};

// ── Context type ─────────────────────────────────────────────
interface AppContextType {
  state: AppState;
  isLoading: boolean;
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
  calculateOrderTotal: (customerId: string) => number;
  saveBill: (customerId: string, bill: Bill) => Promise<void>;
  startNewDay: () => Promise<void>;
  clearTodayData: () => Promise<void>;
  resetAllData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [isLoading, setIsLoading] = useState(true);

  // ── Persist state whenever it changes ──────────────────────
  const persist = useCallback(async (newState: AppState) => {
    setState(newState);
    await saveState(newState);
  }, []);

  // ── Boot: load state from AsyncStorage ─────────────────────
  useEffect(() => {
    (async () => {
      const saved = await loadState();
      if (saved) {
        const savedDate = await getTodayDate();
        const today = getTodayStr();
        if (savedDate !== today) {
          // New day — carry over pending balances from yesterday's bills
          const updatedCustomers = saved.customers.map(c => {
            const bill = saved.todayBills[c.id];
            return bill ? { ...c, pendingAmount: bill.newPending } : c;
          });
          const carried: AppState = {
            ...saved,
            customers: updatedCustomers,
            todayOrders: {},
            todayBills: {},
          };
          await persist(carried);
          await setTodayDate(today);
        } else {
          setState(saved);
        }
      }
      setIsLoading(false);
    })();
  }, [persist]);

  // ── Business ────────────────────────────────────────────────
  const saveBusiness = async (biz: Business) => {
    await persist({ ...state, business: biz });
  };

  const finishSetup = async () => {
    await persist({ ...state, setup: true });
    await setTodayDate(getTodayStr());
  };

  // ── Customers ───────────────────────────────────────────────
  const addCustomer = async (c: Omit<Customer, 'id'>) => {
    await persist({ ...state, customers: [...state.customers, { id: uid(), ...c }] });
  };

  const updateCustomer = async (id: string, c: Omit<Customer, 'id'>) => {
    const customers = state.customers.map(x => (x.id === id ? { ...x, ...c } : x));
    await persist({ ...state, customers });
  };

  const deleteCustomer = async (id: string) => {
    const customers = state.customers.filter(x => x.id !== id);
    const todayOrders = { ...state.todayOrders };
    const todayBills = { ...state.todayBills };
    delete todayOrders[id];
    delete todayBills[id];
    await persist({ ...state, customers, todayOrders, todayBills });
  };

  // ── Products ────────────────────────────────────────────────
  const addProduct = async (p: Omit<Product, 'id'>) => {
    await persist({ ...state, products: [...state.products, { id: uid(), ...p }] });
  };

  const updateProduct = async (id: string, p: Omit<Product, 'id'>) => {
    const products = state.products.map(x => (x.id === id ? { ...x, ...p } : x));
    await persist({ ...state, products });
  };

  const deleteProduct = async (id: string) => {
    await persist({ ...state, products: state.products.filter(x => x.id !== id) });
  };

  const autoPopulateProducts = (marketType: string) => {
    const defaults = DEFAULT_PRODUCTS[marketType] || [];
    const newProducts = defaults.map(p => ({ id: uid(), ...p }));
    const existing = new Set(state.products.map(p => p.name));
    const toAdd = newProducts.filter(p => !existing.has(p.name));
    setState(prev => ({ ...prev, products: [...prev.products, ...toAdd] }));
  };

  // ── Orders ──────────────────────────────────────────────────
  const saveOrder = async (customerId: string, order: Order) => {
    const todayOrders = { ...state.todayOrders, [customerId]: order };
    const todayBills = { ...state.todayBills };
    delete todayBills[customerId];
    await persist({ ...state, todayOrders, todayBills });
  };

  const calculateOrderTotal = (customerId: string): number => {
    const order = state.todayOrders[customerId];
    if (!order?.items) return 0;
    return order.items.reduce((sum, item) => {
      const p = state.products.find(x => x.id === item.productId);
      return sum + (p ? (item.delivered ?? item.qty) * p.price : 0);
    }, 0);
  };

  // ── Billing ─────────────────────────────────────────────────
  const saveBill = async (customerId: string, bill: Bill) => {
    await persist({ ...state, todayBills: { ...state.todayBills, [customerId]: bill } });
  };

  // ── Day management ──────────────────────────────────────────
  const startNewDay = async () => {
    const updatedCustomers = state.customers.map(c => {
      const bill = state.todayBills[c.id];
      return bill ? { ...c, pendingAmount: bill.newPending } : c;
    });
    await persist({ ...state, customers: updatedCustomers, todayOrders: {}, todayBills: {} });
    await setTodayDate(getTodayStr());
  };

  const clearTodayData = async () => {
    await persist({ ...state, todayOrders: {}, todayBills: {} });
  };

  // ── Reset ───────────────────────────────────────────────────
  const resetAllData = async () => {
    await persist(initialState);
    await setTodayDate('');
  };

  return (
    <AppContext.Provider value={{
      state, isLoading,
      saveBusiness, finishSetup,
      addCustomer, updateCustomer, deleteCustomer,
      addProduct, updateProduct, deleteProduct, autoPopulateProducts,
      saveOrder, calculateOrderTotal,
      saveBill,
      startNewDay, clearTodayData, resetAllData,
    }}>
      {children}
    </AppContext.Provider>
  );
}

/** Hook to consume AppContext */
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
