import React, { useEffect, useState } from "react";
import { TextInput, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  ReduceMotion,
  runOnJS,
  runOnUI,
  useReducedMotion,
  cancelAnimation,
} from "react-native-reanimated";
import { PagerGestureContext } from "./gestureContexts";
export function pageDestination(
  index: number,
  translation: number,
  velocity: number,
  width: number,
  count: number,
) {
  "worklet";
  const limitedVelocity = Math.max(-width * 2, Math.min(width * 2, velocity));
  const projected = translation + limitedVelocity * 0.16;
  return Math.max(
    0,
    Math.min(
      count - 1,
      index +
        (Math.abs(projected) > width * 0.28 ? (projected < 0 ? 1 : -1) : 0),
    ),
  );
}
export type TabRequest = { id: number; index: number };

export function SwipeTabs({
  children,
  enabled,
  index,
  onChange,
  request,
}: {
  children: React.ReactNode;
  enabled: boolean;
  index: number;
  onChange: (index: number, requestId: number) => void;
  request: TabRequest;
}) {
  const fallback = useWindowDimensions().width,
    [width, setWidth] = useState(fallback),
    reduce = useReducedMotion(),
    pages = React.Children.toArray(children),
    count = pages.length;
  const x = useSharedValue(-index * width),
    start = useSharedValue(-index * width),
    targetPage = useSharedValue(index),
    externalRequest = useSharedValue(request.id),
    revision = useSharedValue(0),
    dragRevision = useSharedValue(-1),
    viewport = useSharedValue(width),
    gesturePage = useSharedValue(index),
    ended = useSharedValue(false),
    blocked = useSharedValue(false);
  const settle = (target: number) => {
    "worklet";
    const destination = -target * width;
    targetPage.value = target;
    cancelAnimation(x);
    // A duration-based critically damped spring gives slow releases time to glide.
    // Flick velocity chooses the page, rather than making the settling motion snap.
    x.value = reduce
      ? withTiming(destination, {
          duration: 100,
          reduceMotion: ReduceMotion.Never,
        })
      : withSpring(destination, {
          duration: 400,
          dampingRatio: 1,
          velocity: 0,
          overshootClamping: true,
        });
  };
  useEffect(() => {
    // External requests run atomically on the UI thread. React's index update
    // after a swipe is only an acknowledgement, never a new animation command.
    runOnUI((next: TabRequest, nextWidth: number) => {
      "worklet";
      if (next.id < externalRequest.value) return;
      const changed = next.id !== externalRequest.value;
      if (!changed && viewport.value === nextWidth) return;
      externalRequest.value = next.id;
      viewport.value = nextWidth;
      revision.value += 1;
      settle(changed ? next.index : targetPage.value);
    })(request, width);
  }, [request.id, width, reduce]);
  const publish = (target: number, token: number, requestId: number) => {
    // Several gestures can finish before JS processes its callback queue.
    if (revision.value === token) onChange(target, requestId);
  };
  const finishGesture = (target: number) => {
    "worklet";
    revision.value += 1;
    settle(target);
    runOnJS(publish)(target, revision.value, externalRequest.value);
  };
  const style = useAnimatedStyle(() => ({
    flexDirection: "row",
    width: width * count,
    flex: 1,
    transform: [{ translateX: x.value }],
  }));
  const swipe = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onStart((e) => {
      if (blocked.value) return;
      cancelAnimation(x);
      revision.value += 1;
      dragRevision.value = revision.value;
      ended.value = false;
      gesturePage.value = Math.max(
        0,
        Math.min(count - 1, Math.round(-x.value / width)),
      );
      start.value = x.value - e.translationX;
    })
    .onUpdate((e) => {
      if (blocked.value || dragRevision.value !== revision.value) return;
      const next = start.value + e.translationX,
        min = -(count - 1) * width;
      x.value =
        next > 0 ? next * 0.18 : next < min ? min + (next - min) * 0.18 : next;
    })
    .onEnd((e, success) => {
      if (dragRevision.value !== revision.value) return;
      ended.value = true;
      if (!success || blocked.value) {
        finishGesture(targetPage.value);
        return;
      }
      const target = pageDestination(
        gesturePage.value,
        start.value + e.translationX + gesturePage.value * width,
        e.velocityX,
        width,
        count,
      );
      finishGesture(target);
    })
    .onFinalize((_e, success) => {
      if (!success && !ended.value && dragRevision.value === revision.value) {
        ended.value = true;
        finishGesture(targetPage.value);
      }
    });
  return (
    <PagerGestureContext.Provider value={swipe}>
      <GestureDetector gesture={swipe}>
        <View
          onStartShouldSetResponderCapture={() => {
            blocked.value = !!TextInput.State?.currentlyFocusedInput?.();
            return false;
          }}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0) setWidth(w);
          }}
          style={{ flex: 1, overflow: "hidden" }}
        >
          <Animated.View style={style}>
            {pages.map((page, i) => (
              <View
                key={i}
                accessibilityElementsHidden={i !== index}
                importantForAccessibility={
                  i === index ? "auto" : "no-hide-descendants"
                }
                pointerEvents={i === index ? "auto" : "none"}
                style={{ width, flex: 1 }}
              >
                {page}
              </View>
            ))}
          </Animated.View>
        </View>
      </GestureDetector>
    </PagerGestureContext.Provider>
  );
}
