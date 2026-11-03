import React, { useContext, useEffect, useState } from "react";
import {
  AppState,
  ScrollView,
  View,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { PagerGestureContext } from "./gestureContexts";
import { Text } from "./Typography";
import { colors as c } from "./theme";
import { t, formatNumber, getLanguage } from "./i18n";
import { useI18n } from "./i18n/react";
import {
  activityStamp,
  dailyCounts,
  pendingLegacy,
  periodData,
} from "./progression";
import { progress } from "./readingStart";
import type { Local } from "./storage";
import type { Document } from "./core";
export function Progression({
  local,
  owner,
  active,
  onOpen,
}: {
  local: Local;
  owner?: string;
  active: boolean;
  onOpen: (d: Document) => void;
}) {
  useI18n();
  const [mode, setMode] = useState<"week" | "month">("week"),
    [offset, setOffset] = useState(0),
    [today, setToday] = useState(() => activityStamp().day);
  useEffect(() => {
    if (!active) return;
    const refresh = () => setToday(activityStamp().day);
    refresh();
    const timer = setInterval(refresh, 30000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [active]);
  const period = periodData(
      dailyCounts(local.progression, local.queue, owner, local.guestDaily),
      mode,
      offset,
      today,
    ),
    max = Math.max(1, ...period.bars.map((b) => b.words));
  const undated =
    (owner ? local.progression?.undated || 0 : 0) +
    pendingLegacy(local.documents, owner ? local.progression : undefined);
  const pager = useContext(PagerGestureContext),
    native = Gesture.Native();
  if (pager) native.blocksExternalGesture(pager);
  const date = (value: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(getLanguage() === "pt" ? "pt-BR" : "en-US", {
      timeZone: "UTC",
      ...options,
    }).format(new Date(value + "T12:00:00Z"));
  return (
    <View style={{ gap: 16 }}>
      <Text style={s.title}>{t("tabs.progression")}</Text>
      <View style={s.row}>
        {(["week", "month"] as const).map((key) => (
          <TouchableOpacity
            key={key}
            accessibilityRole="radio"
            accessibilityState={{ checked: mode === key }}
            style={[s.button, mode === key && s.selected]}
            onPress={() => {
              setMode(key);
              setOffset(0);
            }}
          >
            <Text style={mode === key ? { color: c.white } : { color: c.ink }}>
              {t(key === "week" ? "progression.week" : "progression.month")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={s.row}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("progression.previous")}
          style={s.button}
          onPress={() => setOffset(offset - 1)}
        >
          <Text systemFont>←</Text>
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: "center", color: c.ink }}>
          {date(period.start, { day: "numeric", month: "short" })} —{" "}
          {date(period.end, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("progression.next")}
          disabled={offset >= 0}
          style={[s.button, offset >= 0 && { opacity: 0.4 }]}
          onPress={() => setOffset(Math.min(0, offset + 1))}
        >
          <Text systemFont>→</Text>
        </TouchableOpacity>
      </View>
      <View style={s.card}>
        <Text style={s.heading}>
          {t(
            offset === 0
              ? mode === "week"
                ? "progression.currentWeek"
                : "progression.currentMonth"
              : "progression.previousPeriod",
          )}
        </Text>
        <Text style={s.body}>
          {t("progression.total", { count: period.total })}
        </Text>
        <Text style={s.body}>
          {t("progression.average", {
            average: formatNumber(Number(period.average.toFixed(1))),
          })}
        </Text>
        <GestureDetector gesture={native}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            contentContainerStyle={{ gap: 10, paddingVertical: 12 }}
          >
            {period.bars.map((b) => (
              <View
                key={b.date}
                accessible
                accessibilityLabel={t(
                  b.future ? "progression.futureDay" : "progression.day",
                  {
                    date: date(b.date, {
                      day: "numeric",
                      month: "long",
                      weekday: "long",
                    }),
                    ...(b.future ? {} : { count: b.words }),
                  },
                )}
                style={{ width: 38, alignItems: "center", gap: 6 }}
              >
                <View
                  style={{ height: 130, justifyContent: "flex-end", width: 24 }}
                >
                  <View
                    style={{
                      height: b.future
                        ? 0
                        : b.words
                          ? Math.max(4, (b.words / max) * 130)
                          : 2,
                      backgroundColor: b.words ? c.wine : c.border,
                      borderRadius: 4,
                    }}
                  />
                </View>
                <Text style={{ fontSize: 12, color: c.muted }}>
                  {mode === "week"
                    ? date(b.date, { weekday: "short" })
                    : date(b.date, { day: "numeric" })}
                </Text>
                <Text style={{ fontSize: 12, color: c.ink }}>
                  {b.future ? "—" : formatNumber(b.words)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </GestureDetector>
        <Text style={s.muted}>{t("progression.definition")}</Text>
      </View>
      {undated > 0 && (
        <Text style={s.muted}>
          {t("progression.undated", { count: undated })}
        </Text>
      )}
      <Text style={s.heading}>{t("progression.documents")}</Text>
      {!local.documents.length && (
        <Text style={s.body}>{t("progression.empty")}</Text>
      )}
      {local.documents.map((d) => {
        const p = progress(d);
        return (
          <TouchableOpacity
            key={d.hash}
            accessibilityRole="button"
            disabled={d.available === false}
            onPress={() => onOpen(d)}
            style={s.card}
          >
            <Text style={s.heading}>{d.title}</Text>
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={d.title}
              accessibilityValue={{ min: 0, max: 100, now: p.percent }}
              style={{ height: 7, borderRadius: 4, backgroundColor: c.border }}
            >
              <View
                style={{
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: c.wine,
                  width: `${p.percent}%`,
                }}
              />
            </View>
            <Text style={s.muted}>
              {t("progression.documentProgress", {
                read: formatNumber(p.presented),
                total: formatNumber(p.total),
                percent: p.percent,
              })}
            </Text>
            {d.available === false && (
              <Text style={s.muted}>{t("library.missingPdf")}</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const s = StyleSheet.create({
  title: { fontSize: 28, fontWeight: "700", color: c.ink },
  heading: { fontSize: 19, fontWeight: "600", color: c.ink },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  button: {
    padding: 12,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: c.soft,
    justifyContent: "center",
  },
  selected: { backgroundColor: c.wine },
  card: {
    padding: 16,
    gap: 12,
    borderRadius: 14,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  body: { fontSize: 16, color: c.ink },
  muted: { fontSize: 13, color: c.muted, lineHeight: 20 },
});
