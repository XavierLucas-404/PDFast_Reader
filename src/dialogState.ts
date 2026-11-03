import { useSyncExternalStore } from "react";
export type DialogAction = {
  text?: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};
type Dialog = { title: string; message?: string; actions: DialogAction[] };
let state: { dialogs: Dialog[]; modals: string[] } = {
  dialogs: [],
  modals: [],
};
let cooldownUntil = 0;
export const modalPresentationDelay = () =>
  Math.max(0, cooldownUntil - Date.now());
const listeners = new Set<() => void>();
function emit(next: typeof state) {
  state = next;
  listeners.forEach((f) => f());
}
export const appAlert = {
  alert(title: string, message?: string, actions?: DialogAction[]) {
    emit({
      ...state,
      dialogs: [
        ...state.dialogs,
        {
          title,
          message,
          actions: actions?.length ? actions : [{ text: "OK" }],
        },
      ],
    });
  },
};
export function closeDialog(action?: DialogAction) {
  if (
    !state.dialogs.length ||
    (action && !state.dialogs[0].actions.includes(action))
  )
    return;
  emit({ ...state, dialogs: state.dialogs.slice(1) });
  action?.onPress?.();
}
export function registerModal(id: string) {
  emit({ ...state, modals: [...state.modals.filter((v) => v !== id), id] });
  return () => {
    cooldownUntil = Date.now() + 350;
    emit({ ...state, modals: state.modals.filter((v) => v !== id) });
  };
}
export function useDialogs() {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => {
        listeners.delete(f);
      };
    },
    () => state,
    () => state,
  );
}

export function discardDialogs() {
  if (state.dialogs.length) emit({ ...state, dialogs: [] });
}
