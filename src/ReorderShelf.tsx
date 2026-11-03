import { Text } from "./Typography";
import { InsertionIndicator } from "./InsertionIndicator";
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  AppState,
} from "react-native";
import { AppModal, modalStyles } from "./AppModal";
import { DragBook } from "./DragBook";
import { t } from "./i18n";
import { useI18n } from "./i18n/react";
import { colors as c } from "./theme";
import type { Document } from "./core";
export function reorderIds(ids: string[], hash: string, index: number) {
  const next = ids.filter((id) => id !== hash);
  if (!ids.includes(hash)) return ids;
  next.splice(Math.max(0, Math.min(next.length, index)), 0, hash);
  return next;
}
function Handle() {
  const line = {
    position: "absolute" as const,
    backgroundColor: c.wine,
    borderRadius: 1,
  };
  return (
    <View pointerEvents="none" style={{ width: 26, height: 26 }}>
      {[6, 12, 18].map((top) => (
        <View
          key={top}
          style={{ ...line, left: 10, top, width: 14, height: 2 }}
        />
      ))}
      <View style={{ ...line, left: 4, top: 3, width: 2, height: 21 }} />
      {[3, 19].map((top) => (
        <View
          key={top}
          style={{
            position: "absolute",
            left: 2,
            top,
            width: 6,
            height: 6,
            borderLeftWidth: 2,
            borderTopWidth: 2,
            borderColor: c.wine,
            transform: [{ rotate: top === 3 ? "45deg" : "225deg" }],
          }}
        />
      ))}
    </View>
  );
}
export function ReorderShelf({
  title,
  documents,
  onClose,
  onSave,
}: {
  title: string;
  documents: Document[];
  onClose: () => void;
  onSave: (ids: string[]) => void;
}) {
  useI18n();
  const [ids, setIds] = useState(documents.map((d) => d.hash)),
    [drag, setDrag] = useState<string | null>(null),
    [target, setTarget] = useState(0);
  const targetRef = useRef(0),
    originals = useRef(new Map(documents.map((d) => [d.hash, d])));
  const active = useRef<{
      hash: string;
      startY: number;
      y: number;
      center: number;
      offset: number;
    } | null>(null),
    offset = useRef(0),
    viewport = useRef(0),
    rows = useRef(new Map<string, { y: number; height: number }>()),
    list = useRef<ScrollView>(null);
  const dims = useWindowDimensions();
  const cancel = () => {
    active.current = null;
    setDrag(null);
  };
  const move = (_x: number, y: number) => {
    const a = active.current;
    if (!a) return;
    a.y = y;
    const center = a.center + y - a.startY + offset.current - a.offset;
    const rest = ids.filter((id) => id !== a.hash);
    const i = rest.findIndex((id) => {
      const r = rows.current.get(id);
      return r && center < r.y + r.height / 2;
    });
    const next = i < 0 ? rest.length : i;
    targetRef.current = next;
    setTarget(next);
  };
  useEffect(() => {
    cancel();
  }, [dims.width, dims.height]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") cancel();
    });
    return () => {
      active.current = null;
      sub.remove();
    };
  }, []);
  useEffect(() => {
    if (!drag) return;
    const timer = setInterval(() => {
      const a = active.current;
      if (!a) return;
      const center = a.center + a.y - a.startY + offset.current - a.offset,
        local = center - offset.current,
        step = local < 50 ? -12 : local > viewport.current - 50 ? 12 : 0;
      if (step)
        list.current?.scrollTo({
          y: Math.max(0, offset.current + step),
          animated: false,
        });
      move(0, a.y);
    }, 32);
    return () => clearInterval(timer);
  }, [drag, ids]);
  const place = (hash: string, direction: number) => {
    const index = ids.indexOf(hash);
    setIds(reorderIds(ids, hash, index + direction));
  };
  return (
    <AppModal onClose={onClose} scroll={false}>
      <Text style={modalStyles.title}>{t("library.reorder")}</Text>
      <Text style={modalStyles.body}>{title}</Text>
      <ScrollView
        ref={list}
        scrollEnabled={!drag}
        onLayout={(e) => {
          viewport.current = e.nativeEvent.layout.height;
        }}
        onScroll={(e) => {
          offset.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        contentContainerStyle={{ gap: 8, paddingVertical: 6 }}
      >
        {!ids.length && (
          <Text style={modalStyles.body}>{t("library.emptyReorder")}</Text>
        )}
        {ids.map((id, i) => {
          const d =
            documents.find((d) => d.hash === id) || originals.current.get(id)!;
          const before = !!drag && ids.filter((v) => v !== drag)[target] === id;
          return (
            <View
              key={id}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={d.title}
              onLayout={(e) =>
                rows.current.set(id, {
                  y: e.nativeEvent.layout.y,
                  height: e.nativeEvent.layout.height,
                })
              }
              style={styles.row}
              accessibilityActions={[
                { name: "increment", label: t("library.moveAfter") },
                { name: "decrement", label: t("library.moveBefore") },
              ]}
              onAccessibilityAction={(e) =>
                place(id, e.nativeEvent.actionName === "increment" ? 1 : -1)
              }
            >
              {before && <InsertionIndicator axis="vertical" color={c.wine} />}
              {drag && target === ids.length - 1 && i === ids.length - 1 && (
                <InsertionIndicator
                  axis="vertical"
                  edge="after"
                  color={c.wine}
                />
              )}
              <DragBook
                onStart={(_x, y) => {
                  const r = rows.current.get(id);
                  if (!r) return;
                  active.current = {
                    hash: id,
                    startY: y,
                    y,
                    center: r.y + r.height / 2,
                    offset: offset.current,
                  };
                  setDrag(id);
                  setTarget(i);
                  targetRef.current = i;
                }}
                onMove={move}
                onEnd={() => {
                  if (active.current)
                    setIds(reorderIds(ids, id, targetRef.current));
                  cancel();
                }}
                onCancel={cancel}
              >
                <View
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t("library.organizeBook", {
                    filename: d.title,
                  })}
                  style={styles.handle}
                >
                  <Handle />
                </View>
              </DragBook>
              <Text style={[modalStyles.body, { flex: 1 }]}>{d.title}</Text>
            </View>
          );
        })}
      </ScrollView>
      <TouchableOpacity
        accessibilityRole="button"
        style={modalStyles.button}
        onPress={() => {
          cancel();
          onSave(ids);
        }}
      >
        <Text style={modalStyles.buttonText}>{t("common.save")}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        style={modalStyles.button}
        onPress={onClose}
      >
        <Text style={modalStyles.buttonText}>{t("common.cancel")}</Text>
      </TouchableOpacity>
    </AppModal>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    backgroundColor: c.surface,
  },
  handle: {
    minWidth: 44,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
});
