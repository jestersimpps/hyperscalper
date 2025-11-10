import { useEffect } from 'react';
import { useOrderStore } from '@/stores/useOrderStore';
import { usePositionStore } from '@/stores/usePositionStore';

export function useLocalStorageSync() {
  useEffect(() => {
    const syncFromLocalStorage = () => {
      try {
        const ordersData = localStorage.getItem('hyperscalper-orders');
        if (ordersData) {
          const parsed = JSON.parse(ordersData);
          if (parsed?.state?.orders) {
            useOrderStore.setState({ orders: parsed.state.orders });
          }
        }

        const positionsData = localStorage.getItem('hyperscalper-positions');
        if (positionsData) {
          const parsed = JSON.parse(positionsData);
          if (parsed?.state?.positions) {
            usePositionStore.setState({ positions: parsed.state.positions });
          }
        }
      } catch (error) {
        console.error('Failed to sync from localStorage:', error);
      }
    };

    const pollInterval = setInterval(syncFromLocalStorage, 5000);

    return () => clearInterval(pollInterval);
  }, []);
}
