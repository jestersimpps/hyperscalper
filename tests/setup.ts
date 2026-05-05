import { vi } from 'vitest';

const memoryStore = new Map<string, string>();
const memoryStorage: Storage = {
  get length() {
    return memoryStore.size;
  },
  clear: () => memoryStore.clear(),
  getItem: (k) => (memoryStore.has(k) ? memoryStore.get(k)! : null),
  key: (i) => Array.from(memoryStore.keys())[i] ?? null,
  removeItem: (k) => {
    memoryStore.delete(k);
  },
  setItem: (k, v) => {
    memoryStore.set(k, String(v));
  },
};

(globalThis as any).localStorage = memoryStorage;
(globalThis as any).sessionStorage = memoryStorage;

vi.mock('react-hot-toast', () => {
  const toast = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    custom: vi.fn(),
    promise: vi.fn(),
  });
  return { default: toast, toast };
});

vi.mock('sonner', () => {
  const toast = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
  });
  return { toast, Toaster: () => null };
});
