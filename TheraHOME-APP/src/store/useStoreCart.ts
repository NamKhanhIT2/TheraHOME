import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface StoreCartState {
  productIds: string[];
  addProduct: (productId: string) => void;
  removeProduct: (productId: string) => void;
  clearCart: () => void;
}

export const useStoreCart = create<StoreCartState>()(
  persist(
    (set) => ({
      productIds: [],
      addProduct: (productId) =>
        set((state) => ({
          productIds: state.productIds.includes(productId)
            ? state.productIds
            : [...state.productIds, productId],
        })),
      removeProduct: (productId) =>
        set((state) => ({ productIds: state.productIds.filter((id) => id !== productId) })),
      clearCart: () => set({ productIds: [] }),
    }),
    {
      name: 'therahome-store-cart',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ productIds: state.productIds }),
    },
  ),
);
