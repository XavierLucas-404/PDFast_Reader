import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  parseReaderColors,
  readerDefaults,
  readerPalette,
  type ReaderColors,
} from "./readerPalette";
export type ReaderPalette = ReturnType<typeof readerPalette>;
export const ReaderPaletteContext = createContext<ReaderPalette | null>(null);
export const useReaderPalette = () => useContext(ReaderPaletteContext);
export const READER_COLORS_KEY = "pdfast.reader.colors";
export function useReaderColors() {
  const [colors, setColors] = useState(readerDefaults),
    [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(READER_COLORS_KEY)
      .then((v) => {
        if (alive && v) {
          try {
            setColors(parseReaderColors(JSON.parse(v)));
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  function save(value: ReaderColors) {
    const next = parseReaderColors(value);
    setColors(next);
    void AsyncStorage.setItem(READER_COLORS_KEY, JSON.stringify(next)).catch(
      () => {},
    );
  }
  return { colors, ready, save, palette: readerPalette(colors) };
}
