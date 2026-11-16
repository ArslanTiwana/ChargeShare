import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastConfig {
  message: string;
  type?: ToastType;
  title?: string;
  durationMs?: number;
}

export interface ConfirmConfig {
  title: string;
  message: string;
  icon?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'danger';
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface UIStoreState {
  // Toast
  toast: (ToastConfig & { id: number }) | null;
  showToast: (config: ToastConfig) => void;
  hideToast: () => void;

  // Confirm Modal
  confirmModal: ConfirmConfig | null;
  showConfirm: (config: ConfirmConfig) => void;
  hideConfirm: () => void;
}

let toastTimer: any = null;
let toastCounter = 0;

export const useUIStore = create<UIStoreState>((set) => ({
  toast: null,
  confirmModal: null,

  showToast: (config) => {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }

    const id = ++toastCounter;
    set({
      toast: {
        ...config,
        type: config.type || 'info',
        id,
      },
    });

    const duration = config.durationMs || 3500;
    toastTimer = setTimeout(() => {
      set((state) => (state.toast?.id === id ? { toast: null } : {}));
      toastTimer = null;
    }, duration);
  },

  hideToast: () => {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    set({ toast: null });
  },

  showConfirm: (config) => {
    set({ confirmModal: config });
  },

  hideConfirm: () => {
    set({ confirmModal: null });
  },
}));

/**
 * Convenient standalone helper functions callable from anywhere (handlers, queries, callbacks).
 */
export const showToast = (config: ToastConfig | string, type: ToastType = 'info') => {
  if (typeof config === 'string') {
    useUIStore.getState().showToast({ message: config, type });
  } else {
    useUIStore.getState().showToast(config);
  }
};

export const showConfirm = (config: ConfirmConfig) => {
  useUIStore.getState().showConfirm(config);
};
