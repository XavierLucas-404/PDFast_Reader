import React, { useContext, useEffect, useRef } from "react";
import { ScrollView, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { PagerGestureContext, RowGestureContext } from "./gestureContexts";
const offsets = new Map<string, number>();
export function clearShelfOffsets(owner?: string) {
  if (!owner) offsets.clear();
  else
    for (const key of offsets.keys())
      if (key.startsWith(owner + ":")) offsets.delete(key);
}
export function ShelfRow({
  id,
  children,
  register,
  onOffset,
  enabled = true,
}: {
  id: string;
  children: React.ReactNode;
  register: (view: ScrollView | null) => void;
  onOffset: (x: number) => void;
  enabled?: boolean;
}) {
  const pager = useContext(PagerGestureContext),
    ref = useRef<ScrollView>(null);
  const native = Gesture.Native();
  if (pager) native.blocksExternalGesture(pager);
  useEffect(() => {
    register(ref.current);
    return () => register(null);
  }, [id]);
  return (
    <RowGestureContext.Provider value={native}>
      <GestureDetector gesture={native}>
        <ScrollView
          ref={ref}
          horizontal
          scrollEnabled={enabled}
          nestedScrollEnabled
          showsHorizontalScrollIndicator
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            ref.current?.scrollTo({ x: offsets.get(id) || 0, animated: false })
          }
          onScroll={(e) => {
            const x = e.nativeEvent.contentOffset.x;
            offsets.set(id, x);
            onOffset(x);
          }}
          scrollEventThrottle={16}
          contentContainerStyle={{
            gap: 16,
            paddingVertical: 4,
            paddingHorizontal: 10,
          }}
        >
          {children}
        </ScrollView>
      </GestureDetector>
    </RowGestureContext.Provider>
  );
}
