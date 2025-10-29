import { useEffect } from 'react';
import { KeyBinding, matchesKey, shouldIgnoreEvent } from '@/lib/keyboard-utils';

export const useKeyboardShortcuts = (bindings: KeyBinding[], enabled: boolean = true) => {
  useEffect(() => {
    if (!enabled || bindings.length === 0) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreEvent(event)) {
        return;
      }

      for (const binding of bindings) {
        if (matchesKey(event, binding.key, binding.modifiers)) {
          event.preventDefault();
          binding.action();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [bindings, enabled]);
};
