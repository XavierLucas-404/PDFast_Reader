import React, { useContext } from "react";
import { RowGestureContext } from "./gestureContexts";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
export function DragBook({
  children,
  onStart,
  onMove,
  onEnd,
  onCancel,
}: {
  children: React.ReactNode;
  onStart: (x: number, y: number, localX: number, localY: number) => void;
  onMove: (x: number, y: number) => void;
  onEnd: () => void;
  onCancel: () => void;
}) {
  const rowGesture = useContext(RowGestureContext);
  const active = useSharedValue(false);
  const style = useAnimatedStyle(() => ({
    opacity: active.value ? 0.3 : 1,
    transform: [{ scale: active.value ? 0.97 : 1 }],
  }));
  const gesture = Gesture.Pan()
    .activateAfterLongPress(350)
    .runOnJS(true)
    .onStart((e) => {
      active.value = true;
      onStart(e.absoluteX, e.absoluteY, e.x, e.y);
    })
    .onUpdate((e) => onMove(e.absoluteX, e.absoluteY))
    .onEnd((_e, success) => {
      if (success) onEnd();
      else onCancel();
    })
    .onFinalize((_e, success) => {
      active.value = false;
      if (!success) onCancel();
    });
  if (rowGesture) gesture.blocksExternalGesture(rowGesture);
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}
