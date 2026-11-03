import { Text, TextInput } from "./Typography";
import { InsertionIndicator } from "./InsertionIndicator";
import { AppModal, modalStyles } from "./AppModal";
import { ShelfRow } from "./ShelfRow";
import { ReorderShelf } from "./ReorderShelf";
import { appAlert as Alert } from "./AppModal";
import * as FS from "expo-file-system/legacy";
import { artworkFile, coverPath } from "./coverFiles";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { formatPercent } from "./i18n";
import { useI18n } from "./i18n/react";
import { t } from "./i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { orderedBooks, placeBook, applyShelfOrder } from "./libraryOrder";
import { BookArtwork } from "./BookArtwork";
import { CoverCache } from "./CoverCache";
import { DragBook } from "./DragBook";
import { useBookDrag } from "./useBookDrag";
import { libraryCounts } from "./libraryLogic";
import { LibraryIcon } from "./LibraryIcons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
  KeyboardAvoidingView,
} from "react-native";
import type { Local } from "./storage";
import type { Document } from "./core";
import {
  coverIndex,
  deleteShelf,
  moveDocument,
  saveShelf,
  shelfNameError,
  type Shelf,
} from "./shelves";
import { colors as c, serif, TAB_SIDE_PADDING } from "./theme";
import { progress } from "./readingStart";
import * as Crypto from "expo-crypto";

type Props = {
  local: Local;
  busy: boolean;
  onUpdate: (f: (v: Local) => Local) => void;
  onImport: () => void;
  onOpen: (d: Document) => void;
  onRename: (hash: string) => void;
  onLocate: (d: Document) => void;
  owner?: string | null;
  onCover?: (d: Document) => void;
  onInteraction?: (active: boolean) => void;
  scrollRef?: React.RefObject<ScrollView | null>;
  scrollOffset?: React.RefObject<number>;
};
export function Library({
  local,
  busy,
  onUpdate,
  onImport,
  onOpen,
  onRename,
  onLocate,
  owner = null,
  onCover,
  onInteraction,
  scrollRef,
  scrollOffset,
}: Props) {
  useI18n();

  const { width, height, fontScale } = useWindowDimensions();
  const [spines, setSpines] = useState(false),
    [cacheEpoch, setCacheEpoch] = useState(0),
    [cacheRequest, setCacheRequest] = useState(0);
  useEffect(() => {
    let valid = true;
    void AsyncStorage.getItem("pdfast.library.view")
      .then((v) => {
        if (valid) setSpines(v === "spines");
      })
      .catch(() => {});
    return () => {
      valid = false;
    };
  }, []);
  function switchView(value: boolean) {
    setSpines(value);
    void AsyncStorage.setItem(
      "pdfast.library.view",
      value ? "spines" : "covers",
    ).catch(() => {});
  }
  const shelfRows = useRef(new Map<string, ScrollView>()),
    horizontalOffsets = useRef(new Map<string, number>());
  const drag = useBookDrag(
    local.documents,
    scrollRef,
    scrollOffset,
    `${width}:${height}:${spines}`,
    (d, target) =>
      onUpdate((v) => placeBook(v, d.hash, target.shelf, target.before)),
    { rows: shelfRows, offsets: horizontalOffsets },
  );

  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const availableWidth =
    measuredWidth ?? Math.max(1, width - TAB_SIDE_PADDING * 2);
  const columns = Math.max(
    1,
    Math.floor(
      (availableWidth + 16) /
        ((spines ? 52 : 145) * Math.max(1, fontScale) + 16),
    ),
  );
  const bookWidth = Math.min(
    spines ? 100 : 220,
    (availableWidth - (columns - 1) * 16) / columns,
  );
  const [editor, setEditor] = useState<Shelf | null>(null);
  const [name, setName] = useState("");
  const [book, setBook] = useState<Document | null>(null);
  const [shelfMenu, setShelfMenu] = useState<Shelf | null>(null);
  const [moving, setMoving] = useState(false);
  const [reorder, setReorder] = useState<Shelf | null>(null);
  useEffect(() => {
    onInteraction?.(
      !!drag.drag || !!editor || !!book || !!shelfMenu || !!reorder,
    );
    return () => onInteraction?.(false);
  }, [drag.drag, editor, book, shelfMenu, reorder]);
  const error = editor ? shelfNameError(name, local.shelves, editor.id) : "";
  function edit(shelf?: Shelf) {
    setName(shelf?.name || "");
    setEditor(shelf || { id: Crypto.randomUUID(), name: "" });
  }
  function remove(shelf: Shelf) {
    Alert.alert(
      t("library.deleteShelfTitle", { name: shelf.name }),
      t("library.deleteShelfBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("library.deleteShelf"),
          style: "destructive",
          onPress: () => onUpdate((v) => deleteShelf(v, shelf.id)),
        },
      ],
    );
  }
  const groups = [...local.shelves, { id: "", name: t("library.unassigned") }];
  return (
    <View
      collapsable={false}
      ref={drag.root}
      style={s.library}
      onLayout={(e) => setMeasuredWidth(e.nativeEvent.layout.width)}
    >
      <View style={s.intro}>
        <View style={[s.actions, { flexWrap: "wrap" }]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("library.importPdf")}
            disabled={busy}
            style={[
              s.primary,
              { flexDirection: "row", gap: 5 },
              busy && { opacity: 0.5 },
            ]}
            onPress={onImport}
          >
            {busy ? (
              <ActivityIndicator color={c.white} />
            ) : (
              <>
                <Text systemFont style={{ fontSize: 24, color: c.white }}>
                  +
                </Text>
                <LibraryIcon kind="book" color={c.white} />
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("library.newShelf")}
            style={[s.secondary, { flexDirection: "row", gap: 5 }]}
            onPress={() => edit()}
          >
            <Text systemFont style={{ fontSize: 24, color: c.wine }}>
              +
            </Text>
            <LibraryIcon kind="shelf" color={c.wine} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("library.covers")}
            accessibilityState={{ selected: !spines }}
            style={[
              s.secondary,
              !spines && { borderWidth: 2, borderColor: c.gold },
            ]}
            onPress={() => switchView(false)}
          >
            <LibraryIcon kind="book" color={c.wine} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("library.spines")}
            accessibilityState={{ selected: spines }}
            style={[
              s.secondary,
              spines && { borderWidth: 2, borderColor: c.gold },
            ]}
            onPress={() => switchView(true)}
          >
            <LibraryIcon kind="shelf" color={c.wine} />
          </TouchableOpacity>
        </View>
        <Text style={s.caption}>
          {libraryCounts(local.documents.length, local.shelves.length)}
        </Text>
      </View>
      {!local.documents.length && (
        <View style={s.empty}>
          <Text style={s.heading}>{t("library.emptyTitle")}</Text>
          <Text style={s.body}>{t("library.emptyBody")}</Text>
        </View>
      )}
      {groups.map((group) => {
        const documents = orderedBooks(local.documents, group.id);
        return (
          <View
            key={group.id}
            collapsable={false}
            ref={(v) => {
              if (v) drag.groups.current.set(group.id, v);
              else drag.groups.current.delete(group.id);
            }}
            style={[
              s.group,
              drag.drop?.shelf === group.id && {
                backgroundColor: c.soft,
                borderRadius: 12,
              },
            ]}
          >
            <View style={s.groupHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.heading}>{group.name}</Text>
                <Text style={s.caption}>
                  {drag.drag && drag.drop?.shelf === group.id
                    ? t("library.dropHere")
                    : t("library.bookCount", { count: documents.length })}
                </Text>
              </View>
              {
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t("library.shelfOptions", {
                    name: group.name,
                  })}
                  style={s.menu}
                  onPress={() => setShelfMenu(group)}
                >
                  <Text systemFont style={s.link}>
                    •••
                  </Text>
                </TouchableOpacity>
              }
            </View>
            {!documents.length && (
              <View style={[s.emptyShelf, { minHeight: 80 }]}>
                <Text style={s.body}>
                  {t(
                    group.id ? "library.emptyShelf" : "library.unassignedBody",
                  )}
                </Text>
              </View>
            )}
            {!!documents.length && (
              <>
                <ShelfRow
                  id={`${owner || "guest"}:${spines ? "spines" : "covers"}:${group.id}`}
                  enabled={!drag.drag}
                  register={(view) => {
                    if (view) shelfRows.current.set(group.id, view);
                    else shelfRows.current.delete(group.id);
                  }}
                  onOffset={(x) => horizontalOffsets.current.set(group.id, x)}
                >
                  {documents.map((d, index) => (
                    <View
                      key={d.hash}
                      collapsable={false}
                      ref={(v) => {
                        if (v) drag.books.current.set(d.hash, v);
                        else drag.books.current.delete(d.hash);
                      }}
                      style={{
                        width: bookWidth,
                        gap: 8,
                      }}
                    >
                      {drag.drag &&
                        drag.drop?.shelf === group.id &&
                        drag.drop.before === d.hash && (
                          <InsertionIndicator
                            axis="horizontal"
                            color={c.gold}
                          />
                        )}
                      {drag.drag &&
                        drag.drop?.shelf === group.id &&
                        !drag.drop.before &&
                        index === documents.length - 1 && (
                          <InsertionIndicator
                            axis="horizontal"
                            edge="after"
                            color={c.gold}
                          />
                        )}
                      <DragBook
                        onStart={(x, y, localX, localY) =>
                          void drag.start(d, x, y, localX, localY)
                        }
                        onMove={drag.move}
                        onEnd={drag.end}
                        onCancel={drag.cancel}
                      >
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={t(
                            "library.documentProgressOptions",
                            {
                              filename: d.title,
                              percent: formatPercent(progress(d).percent),
                            },
                          )}
                          onPress={() => {
                            if (!drag.drag) {
                              setBook(d);
                              setMoving(false);
                            }
                          }}
                        >
                          <BookArtwork
                            document={d}
                            owner={owner}
                            spine={spines}
                            epoch={cacheEpoch}
                            onImageError={() => {
                              const file = artworkFile(d, owner);
                              if (file && !d.customCover)
                                void FS.deleteAsync(coverPath(file), {
                                  idempotent: true,
                                })
                                  .then(() => setCacheRequest((n) => n + 1))
                                  .catch(() => {});
                            }}
                            width={bookWidth}
                          />
                        </TouchableOpacity>
                      </DragBook>
                      {d.available === false && (
                        <Text style={s.caption}>{t("library.missingPdf")}</Text>
                      )}
                      <View
                        accessible
                        accessibilityRole="progressbar"
                        accessibilityLabel={d.title}
                        accessibilityValue={{
                          min: 0,
                          max: 100,
                          now: progress(d).percent,
                        }}
                        style={s.track}
                      >
                        <View
                          style={[s.fill, { width: `${progress(d).percent}%` }]}
                        />
                      </View>
                    </View>
                  ))}
                </ShelfRow>
                <View style={s.plank} />
                <View style={s.plankShadow} />
              </>
            )}
          </View>
        );
      })}
      <CoverCache
        documents={local.documents}
        request={cacheRequest}
        owner={owner}
        onRefresh={() => setCacheEpoch((n) => n + 1)}
      />
      {drag.drag && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: drag.ghost.x,
            top: drag.ghost.y,
            zIndex: 1000,
            elevation: 20,
            opacity: 0.9,
          }}
        >
          <BookArtwork document={drag.drag} owner={owner} width={80} />
        </View>
      )}
      <AppModal
        visible={!!editor || !!book || !!shelfMenu}
        onClose={() => {
          setEditor(null);
          setBook(null);
          setShelfMenu(null);
        }}
      >
        {shelfMenu ? (
          <>
            <Text style={modalStyles.title}>{shelfMenu.name}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={modalStyles.button}
              onPress={() => {
                const selected = shelfMenu;
                setShelfMenu(null);
                setReorder(selected);
              }}
            >
              <Text style={modalStyles.buttonText}>{t("library.reorder")}</Text>
            </TouchableOpacity>
            {!!shelfMenu.id && (
              <>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={modalStyles.button}
                  onPress={() => {
                    const shelf = shelfMenu;
                    setShelfMenu(null);
                    edit(shelf);
                  }}
                >
                  <Text style={modalStyles.buttonText}>
                    {t("common.rename")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={modalStyles.button}
                  onPress={() => {
                    const shelf = shelfMenu;
                    setShelfMenu(null);
                    remove(shelf);
                  }}
                >
                  <Text style={modalStyles.buttonText}>
                    {t("library.deleteShelf")}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </>
        ) : editor ? (
          <>
            <Text style={modalStyles.title}>
              {local.shelves.some((v) => v.id === editor.id)
                ? t("library.renameShelf")
                : t("library.newShelf")}
            </Text>
            <Text style={s.body}>{t("library.shelfPrompt")}</Text>
            <TextInput
              autoFocus
              accessibilityLabel={t("library.shelfName")}
              value={name}
              onChangeText={setName}
              maxLength={60}
              style={s.input}
              onSubmitEditing={() => {
                if (!error) {
                  onUpdate((v) => saveShelf(v, { ...editor, name }));
                  setEditor(null);
                }
              }}
            />
            {!!error && (
              <Text accessibilityLiveRegion="polite" style={s.error}>
                {error}
              </Text>
            )}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: !!error }}
              disabled={!!error}
              style={[s.primary, !!error && { opacity: 0.45 }]}
              onPress={() => {
                onUpdate((v) => saveShelf(v, { ...editor, name }));
                setEditor(null);
              }}
            >
              <Text style={s.primaryText}>{t("library.saveShelf")}</Text>
            </TouchableOpacity>
          </>
        ) : (
          book && (
            <>
              <Text style={modalStyles.title}>
                {moving ? t("library.move") : book.title}
              </Text>
              {moving ? (
                groups.map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: (book.shelfId || "") === g.id,
                    }}
                    style={modalStyles.button}
                    onPress={() => {
                      onUpdate((v) =>
                        moveDocument(v, book.hash, g.id || undefined),
                      );
                      setBook(null);
                    }}
                  >
                    <Text style={modalStyles.buttonText}>
                      {g.name}
                      {(book.shelfId || "") === g.id ? " ✓" : ""}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <>
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={book.available === false}
                    accessibilityState={{
                      disabled: book.available === false,
                    }}
                    style={[
                      s.secondary,
                      book.available === false && { opacity: 0.4 },
                    ]}
                    onPress={() => {
                      const selected = book;
                      setBook(null);
                      onOpen(selected);
                    }}
                  >
                    <Text style={modalStyles.buttonText}>
                      {t("library.open")}
                    </Text>
                  </TouchableOpacity>
                  {book.available === false && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      style={modalStyles.button}
                      onPress={() => {
                        const selected = book;
                        setBook(null);
                        onLocate(selected);
                      }}
                    >
                      <Text style={modalStyles.buttonText}>
                        {t("library.locate")}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={modalStyles.button}
                    onPress={() => {
                      const selected = book;
                      setBook(null);
                      onCover?.(selected);
                    }}
                  >
                    <Text style={modalStyles.buttonText}>
                      {t("library.changeCover")}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityRole="button"
                    style={modalStyles.button}
                    onPress={() => {
                      onRename(book.hash);
                      setBook(null);
                    }}
                  >
                    <Text style={modalStyles.buttonText}>
                      {t("common.rename")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={modalStyles.button}
                    onPress={() => setMoving(true)}
                  >
                    <Text style={modalStyles.buttonText}>
                      {t("library.move")}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )
        )}
        <TouchableOpacity
          accessibilityRole="button"
          style={modalStyles.button}
          onPress={() => {
            setEditor(null);
            setBook(null);
            setShelfMenu(null);
          }}
        >
          <Text style={modalStyles.buttonText}>{t("common.cancel")}</Text>
        </TouchableOpacity>
      </AppModal>
      {reorder && (
        <ReorderShelf
          key={reorder.id}
          title={reorder.name}
          documents={orderedBooks(local.documents, reorder.id)}
          onClose={() => setReorder(null)}
          onSave={(ids) => {
            onUpdate((v) => applyShelfOrder(v, reorder.id, ids));
            setReorder(null);
          }}
        />
      )}
    </View>
  );
}
const s = StyleSheet.create({
  library: { gap: 28 },
  intro: {
    gap: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: c.border,
  },
  eyebrow: { fontSize: 11, letterSpacing: 2, color: c.blue, fontWeight: "700" },
  title: { fontFamily: serif, fontSize: 34, lineHeight: 42, color: c.ink },
  body: { color: c.muted, fontSize: 16, lineHeight: 25 },
  caption: { color: c.muted, fontSize: 12, lineHeight: 20 },
  heading: { fontFamily: serif, color: c.ink, fontSize: 24, lineHeight: 32 },
  actions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  primary: {
    minHeight: 48,
    padding: 14,
    borderRadius: 8,
    backgroundColor: c.wine,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: c.surface, fontWeight: "700", fontSize: 15 },
  secondary: {
    minHeight: 48,
    padding: 14,
    backgroundColor: c.soft,
    borderRadius: 8,
    justifyContent: "center",
  },
  link: { color: c.wine, fontWeight: "600", fontSize: 14 },
  empty: {
    padding: 20,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    gap: 10,
    backgroundColor: c.surface,
  },
  group: { gap: 14 },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  menu: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyShelf: {
    padding: 20,
    backgroundColor: c.soft,
    borderBottomWidth: 7,
    borderColor: c.gold,
    gap: 8,
  },
  books: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-end",
    paddingTop: 4,
  },
  cover: {
    borderTopRightRadius: 7,
    borderBottomRightRadius: 3,
    padding: 12,
    paddingLeft: 18,
    shadowColor: c.ink,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 3, height: 2 },
    elevation: 4,
  },
  spine: {
    position: "absolute",
    left: 5,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: "#FFFFFF20",
  },
  coverFrame: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.gold,
    padding: 12,
    gap: 14,
    justifyContent: "space-between",
    alignItems: "center",
  },
  coverTitle: {
    color: c.surface,
    fontFamily: serif,
    fontSize: 20,
    lineHeight: 27,
    textAlign: "center",
  },
  coverLabel: {
    color: c.parchment,
    fontSize: 8,
    letterSpacing: 1.2,
    textAlign: "center",
  },
  ornament: { color: c.gold, fontSize: 18 },
  plank: {
    height: 9,
    backgroundColor: c.gold,
    borderTopWidth: 2,
    borderTopColor: c.parchment,
    borderBottomWidth: 2,
    borderBottomColor: "#80613F",
    marginHorizontal: -5,
    borderRadius: 2,
  },
  plankShadow: { height: 5, backgroundColor: "#33252B12" },
  details: { flexDirection: "row", gap: 16, paddingTop: 10, paddingBottom: 10 },
  bookTitle: { color: c.ink, fontWeight: "600", fontSize: 14, lineHeight: 21 },
  track: {
    height: 3,
    backgroundColor: c.border,
    marginTop: 8,
    marginBottom: 4,
  },
  fill: { height: 3, backgroundColor: c.wine },
  bookMenu: { minHeight: 48, justifyContent: "center" },
  overlay: { flex: 1, backgroundColor: "#33252B99" },
  modalHost: { flex: 1 },
  modalScroll: { flexGrow: 1, justifyContent: "center", padding: 22 },
  modal: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    backgroundColor: c.paper,
    borderRadius: 14,
    padding: 24,
    gap: 16,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: c.gold,
    backgroundColor: c.surface,
    borderRadius: 8,
    padding: 14,
    fontSize: 18,
    color: c.ink,
  },
  error: { color: c.wine, fontSize: 14 },
});
