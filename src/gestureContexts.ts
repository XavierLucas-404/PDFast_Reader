import { createContext } from "react";
import { Gesture } from "react-native-gesture-handler";
export const PagerGestureContext = createContext<ReturnType<
  typeof Gesture.Pan
> | null>(null);
export const RowGestureContext = createContext<ReturnType<
  typeof Gesture.Native
> | null>(null);
