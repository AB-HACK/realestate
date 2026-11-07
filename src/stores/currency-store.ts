import { create } from 'zustand';
import { CurrencyCode } from '../types';

interface CurrencyState {
  displayCurrency: CurrencyCode;
  ngnPerUsd: number;
  setCurrency: (currency: CurrencyCode) => void;
  toggleCurrency: () => void;
  setExchangeRate: (rate: number) => void;
  formatPrice: (amount: number, baseCurrency: CurrencyCode) => string;
}

export const useCurrencyStore = create<CurrencyState>((set, get) => ({
  displayCurrency: 'NGN',
  ngnPerUsd: 1600,

  setCurrency: (currency) => set({ displayCurrency: currency }),

  toggleCurrency: () =>
    set((state) => ({
      displayCurrency: state.displayCurrency === 'NGN' ? 'USD' : 'NGN',
    })),

  setExchangeRate: (rate) => set({ ngnPerUsd: Math.max(1, rate) }),

  formatPrice: (amount, baseCurrency) => {
    const { displayCurrency, ngnPerUsd } = get();
    let converted = amount;
    if (baseCurrency === 'NGN' && displayCurrency === 'USD') {
      converted = amount / ngnPerUsd;
    } else if (baseCurrency === 'USD' && displayCurrency === 'NGN') {
      converted = amount * ngnPerUsd;
    }

    if (displayCurrency === 'NGN') {
      return `₦${Math.round(converted).toLocaleString('en-NG')}`;
    }
    return `$${Math.round(converted).toLocaleString('en-US')}`;
  },
}));
