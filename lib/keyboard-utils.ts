export interface KeyModifiers {
  shift?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  meta?: boolean;
}

export interface KeyBinding {
  key: string;
  modifiers?: KeyModifiers;
  action: () => void | Promise<void>;
  description: string;
}

export const isInputElement = (element: Element | null): boolean => {
  if (!element) return false;

  const tagName = element.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    element.getAttribute('contenteditable') === 'true'
  );
};

export const matchesKey = (
  event: KeyboardEvent,
  key: string,
  modifiers?: KeyModifiers
): boolean => {
  const eventKey = event.key.toLowerCase();
  const targetKey = key.toLowerCase();

  if (eventKey !== targetKey) {
    return false;
  }

  if (modifiers) {
    if (modifiers.shift !== undefined && event.shiftKey !== modifiers.shift) {
      return false;
    }
    if (modifiers.ctrl !== undefined && event.ctrlKey !== modifiers.ctrl) {
      return false;
    }
    if (modifiers.alt !== undefined && event.altKey !== modifiers.alt) {
      return false;
    }
    if (modifiers.meta !== undefined && event.metaKey !== modifiers.meta) {
      return false;
    }
  } else {
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
      return false;
    }
  }

  return true;
};

export const shouldIgnoreEvent = (event: KeyboardEvent): boolean => {
  return isInputElement(event.target as Element);
};
