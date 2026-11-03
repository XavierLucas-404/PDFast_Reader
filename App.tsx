import { bookmark, resumePage, localResume, wordPosition } from "./src/resume";
import { AppFonts } from "./src/AppFonts";
import { Text, TextInput } from "./src/Typography";
import { discardDialogs } from "./src/dialogState";
import { DialogHost } from "./src/AppModal";
import { Settings } from "./src/Settings";
import {
  useReaderColors,
  useReaderPalette,
  ReaderPaletteContext,
} from "./src/readerAppearance";
import { clearShelfOffsets } from "./src/ShelfRow";
import { appAlert as Alert } from "./src/AppModal";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SwipeTabs } from "./src/SwipeTabs";
import { CoverChooser } from "./src/CoverChooser";
import { orderValue } from "./src/libraryOrder";
import {
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { useLanguagePreference, LanguagePicker } from "./src/i18n/react";
import { formatNumber, formatPercent, formatDate, ordinal } from "./src/i18n";
import { m, renderMessage, type MessageValue } from "./src/i18n";
import { t, AppError } from "./src/i18n";
import { attachFile, checkImportedHash } from "./src/libraryFiles";
import { sealedSessions } from "./src/syncQueue";
import { AutoSync } from "./src/autoSync";
import { colors, serif, TAB_SIDE_PADDING } from "./src/theme";
import { Library } from "./src/Library";
import React, { useEffect, useRef, useState } from "react";
import {
  AppState,
  ActivityIndicator,
  Linking,
  ScrollView,
  View,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Picker from "expo-document-picker";
import * as FS from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import { Session } from "@supabase/supabase-js";
import {
  Document,
  ReadingSession,
  delay,
  eligible,
  nextWeek,
} from "./src/core";
import {
  catalog,
  mergeLibrary,
  sameCatalog,
  totalWords,
  type LibraryReply,
} from "./src/librarySync";
import {
  Local,
  empty,
  readLocal,
  writeLocal,
  legacyAvailable,
  claimLegacy,
  clearWorkspace,
} from "./src/storage";
import { profileState } from "./src/profileLogic";
import { ManageProfile } from "./src/ManageProfile";
import { AuthPanel } from "./src/AuthPanel";
import { authError, errorMessage, parseAuthLink } from "./src/authLogic";
import { backend, rpc, recoveryState, readOfflineSession } from "./src/backend";
import { normalizeTitle } from "./src/titles";
import { EXTRACTION_VERSION, type PdfExtraction } from "./src/extraction";
import { CHAPTER_DETECTION_VERSION, chapterWait } from "./src/chapters";
import {
  addChapterMetadata,
  migrateDocument,
  migratePendingSessions,
} from "./src/extractionMigration";
import { progress } from "./src/readingStart";
import { SentencePicker } from "./src/SentencePicker";
import { PdfPageReader } from "./src/PdfPageReader";
import { RenameDocument } from "./src/RenameDocument";
import { getReadingContext } from "./src/readingContext";
import { WordReader } from "./src/WordReader";
import { PlaybackClock } from "./src/playback";
import { PdfView } from "./src/PdfView";
const tabs = ["library", "friends", "ranking", "profile"] as const;
const message = (e: unknown) => authError(e);
function Button({
  label,
  onPress,
  secondary = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  accessibilityLabel?: string;
}) {
  const readerPalette = useReaderPalette();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      onPress={onPress}
      style={[
        s.button,
        secondary && s.secondary,
        readerPalette && {
          backgroundColor: secondary
            ? readerPalette.soft
            : readerPalette.accent,
          borderColor: readerPalette.border,
        },
      ]}
    >
      <Text
        style={[
          s.buttonText,
          secondary && { color: colors.ink },
          readerPalette && {
            color: secondary
              ? readerPalette.secondaryInk
              : readerPalette.onAccent,
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <AppFonts>
          <AppContent />
          <DialogHost />
        </AppFonts>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
function AppContent() {
  const languageReady = useLanguagePreference();
  const appearance = useReaderColors(),
    palette = appearance.palette;
  const [settings, setSettings] = useState(false);
  const tabScrollRefs = useRef<Record<string, ScrollView | null>>({});
  const [local, setLocal] = useState<Local>(empty),
    [loaded, setLoaded] = useState(false),
    [tab, setTab] = useState<(typeof tabs)[number]>("library");
  const [selected, setSelected] = useState<string | null>(null),
    [importing, setImporting] = useState<{
      hash: string;
      uri: string;
      title: string;
    } | null>(null);
  const [mode, setMode] = useState<"words" | "pdf">("pdf"),
    [playing, setPlaying] = useState(false),
    [chapterTransition, setChapterTransition] = useState(false),
    [active, setActive] = useState(true),
    [wpm, setWpm] = useState(250),
    [font, setFont] = useState(36),
    [sessionWords, setSessionWords] = useState(0),
    [elapsed, setElapsed] = useState(0);
  const [auth, setAuth] = useState<Session | null>(null),
    [managingProfile, setManagingProfile] = useState(false),
    [search, setSearch] = useState(""),
    [friends, setFriends] = useState<any[]>([]),
    [results, setResults] = useState<any[]>([]),
    [ranking, setRanking] = useState<any[]>([]),
    [profile, setProfile] = useState<any>(null),
    [profileError, setProfileError] = useState<MessageValue>(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<MessageValue>("");
  const [recovery, setRecovery] = useState(false);
  const [authReady, setAuthReady] = useState(!backend);
  useEffect(() => {
    setManagingProfile(false);
    setSettings(false);
  }, [tab, recovery]);
  const mainScroll = useRef<ScrollView>(null),
    scrollOffset = useRef(0),
    tabOffsets = useRef<Record<string, number>>({});
  useEffect(() => {
    const y = managingProfile || settings ? 0 : tabOffsets.current[tab] || 0;
    scrollOffset.current = y;
    mainScroll.current?.scrollTo({ y, animated: false });
    const timer = setTimeout(() => {
      mainScroll.current?.scrollTo({ y, animated: false });
      scrollOffset.current = y;
      pendingTabScroll.current = null;
    }, 32);
    return () => clearTimeout(timer);
  }, [tab, managingProfile, settings]);
  const pendingTabScroll = useRef<{ tab: string; y: number } | null>(null);
  const tabRequestId = useRef(0);
  const tabRef = useRef(tab);
  const [tabRequest, setTabRequest] = useState({ id: 0, index: 0 });
  function commitTab(next: (typeof tabs)[number]) {
    if (next === tabRef.current) return;
    tabOffsets.current[tabRef.current] = scrollOffset.current;
    pendingTabScroll.current = { tab: next, y: tabOffsets.current[next] || 0 };
    tabRef.current = next;
    setTab(next);
  }
  function changeTab(next: (typeof tabs)[number]) {
    // Even a tap on the selected tab is a new navigation request.
    const id = ++tabRequestId.current;
    setTabRequest({ id, index: tabs.indexOf(next) });
    commitTab(next);
  }
  function commitSwipe(index: number, requestId: number) {
    // A queued gesture callback must not override a more recent button tap.
    if (requestId === tabRequestId.current) commitTab(tabs[index]);
  }
  const [libraryInteraction, setLibraryInteraction] = useState(false);
  const [coverRequest, setCoverRequest] = useState<{
    hash: string;
    initial: boolean;
    generation: number;
  } | null>(null);
  const workspace = useRef<string | null | undefined>(undefined);
  const workspaceGeneration = useRef(0);
  const [loadRetry, setLoadRetry] = useState(0);
  const [hasLegacy, setHasLegacy] = useState(false);
  const [legacyDeferred, setLegacyDeferred] = useState(false);
  const authOwner = useRef<string | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const current = local.documents.find((d) => d.hash === selected);
  const [migration, setMigration] = useState<string | null>(null);
  const migrationRef = useRef<string | null>(null);
  const [migrationFailures, setMigrationFailures] = useState<string[]>([]);
  const [processingProgress, setProcessingProgress] =
    useState<MessageValue>("");
  const [pdfPage, setPdfPage] = useState(1);
  const [choosingStart, setChoosingStart] = useState(false);
  const [renameHash, setRenameHash] = useState<string | null>(null);
  const migrating = local.documents.find((d) => d.hash === migration);
  const processing = importing || migrating;
  const renameDocument = local.documents.find((d) => d.hash === renameHash);
  const needsUpgrade = (d: Document) =>
    d.available !== false &&
    (d.chapterDetectionVersion !== CHAPTER_DETECTION_VERSION ||
      ((d.extractionVersion || 1) < EXTRACTION_VERSION &&
        !d.synced &&
        (!backend || !!auth)));
  const upgradesPending = local.documents.some(
    (d) => needsUpgrade(d) && !migrationFailures.includes(d.hash),
  );
  useEffect(() => {
    if (
      !loaded ||
      !authReady ||
      playing ||
      importing ||
      migrationRef.current ||
      syncLock.current
    )
      return;
    const legacy = local.documents.find(
      (d) => needsUpgrade(d) && !migrationFailures.includes(d.hash),
    );
    if (legacy) {
      pauseReading();
      migrationRef.current = legacy.hash;
      setProcessingProgress("");
      setMigration(legacy.hash);
    }
  }, [
    loaded,
    authReady,
    local.documents,
    playing,
    importing,
    migration,
    migrationFailures,
    auth?.user.id,
  ]);
  useEffect(() => {
    setChoosingStart(false);
  }, [selected]);
  const renderGeneration = workspaceGeneration.current;
  const stateRef = useRef(local);
  stateRef.current = local;
  const activityRef = useRef(AppState.currentState === "active");
  const chunk = useRef<ReadingSession | null>(null);
  const elapsedRef = useRef(0);
  const syncLock = useRef(false);
  const [syncEpoch, setSyncEpoch] = useState(0);
  const [syncError, setSyncError] = useState<MessageValue>("");
  const syncInFlight = useRef<Promise<void> | null>(null);
  const autoSync = useRef<AutoSync | null>(null);
  const syncLatest = useRef<() => Promise<void>>(async () => {});
  const playbackClock = useRef(new PlaybackClock());
  function pauseReading() {
    playbackClock.current.cancel();
    setPlaying(false);
    setChapterTransition(false);
    flush();
  }
  function update(f: (v: Local) => Local, requestSync = true) {
    if (workspace.current === undefined) return;
    const next = f(stateRef.current);
    stateRef.current = next;
    setLocal(next);
    void writeLocal(next, workspace.current).catch((e) =>
      setNotice(m("errors.save", { reason: errorMessage(e) })),
    );
    if (requestSync) setSyncEpoch((n) => n + 1);
  }
  function flush() {
    const c = chunk.current;
    chunk.current = null;
    if (c && c.positions.length) {
      update((v) => ({
        ...v,
        queue: [...v.queue.filter((q) => q.id !== c.id), c],
      }));
      setSyncEpoch((n) => n + 1);
    }
  }
  async function action(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert("PDFast Reader", authError(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!backend) return;
    let mounted = true;
    let lastLink = "";
    let usingOfflineSession = false;
    function receive(session: Session | null) {
      if (!mounted) return;
      if (authOwner.current !== (session?.user.id || null)) {
        pauseReading();
        autoSync.current?.dispose();
        autoSync.current = null;
        workspaceGeneration.current++;
        workspace.current = undefined;
        stateRef.current = empty;
        setLocal(empty);
        setLoaded(false);
        setSelected(null);
        setImporting(null);
        setMigration(null);
        migrationRef.current = null;
        setRenameHash(null);
        setCoverRequest(null);
        tabOffsets.current = {};
        discardDialogs();
        setSettings(false);
        scrollOffset.current = 0;
        setNotice("");
        setSessionWords(0);
        setElapsed(0);
        elapsedRef.current = 0;
        setProfile(null);
        setSyncError("");
        setProfileError("");
        setFriends([]);
        setRanking([]);
        setResults([]);
        setManagingProfile(false);
        authOwner.current = session?.user.id || null;
        setMigrationFailures([]);
      }
      setAuth(session);
    }
    const { data } = backend.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" && !session && usingOfflineSession)
        return;
      if (session || event === "SIGNED_OUT") usingOfflineSession = false;
      receive(session);
      if (event === "PASSWORD_RECOVERY") {
        setRecovery(true);
        setSelected(null);
        changeTab("profile");
      }
      if (event === "SIGNED_OUT") {
        setRecovery(false);
        void recoveryState.clear();
      }
    });
    async function link(value: string | null) {
      if (!value || lastLink === value) return;
      try {
        const parsed = parseAuthLink(value);
        if (!parsed) return;
        lastLink = value;
        pauseReading();
        setSelected(null);
        changeTab("profile");
        if (parsed.recovery) {
          await recoveryState.set();
          setRecovery(true);
        }
        const { error } = await backend!.auth.exchangeCodeForSession(
          parsed.code,
        );
        if (error) throw error;
        if (parsed.recovery) setRecovery(true);
        else setNotice(m("auth.emailConfirmed"));
      } catch (e) {
        await recoveryState.clear();
        setRecovery(false);
        changeTab("profile");
        setNotice(errorMessage(e));
      }
    }
    const links = Linking.addEventListener("url", ({ url }) => void link(url));
    void recoveryState
      .get()
      .then((saved) => {
        if (saved) {
          setRecovery(true);
          changeTab("profile");
        }
        return backend!.auth.getSession();
      })
      .then(async ({ data, error }) => {
        if (error) {
          const cached = await readOfflineSession(error);
          if (cached) {
            usingOfflineSession = true;
            receive(cached);
          } else setNotice(errorMessage(error));
        } else receive(data.session);
        return Linking.getInitialURL();
      })
      .then(link)
      .catch((e) => setNotice(errorMessage(e)))
      .finally(() => {
        if (mounted) setAuthReady(true);
      });
    if (AppState.currentState === "active") backend.auth.startAutoRefresh();
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
      links.remove();
      backend?.auth.stopAutoRefresh();
    };
  }, []);
  useEffect(() => {
    if (!authReady) return;
    const owner = auth?.user.id || null;
    const generation = ++workspaceGeneration.current;
    setLoaded(false);
    workspace.current = undefined;
    void readLocal(owner)
      .then(async (value) => {
        if (
          generation !== workspaceGeneration.current ||
          authOwner.current !== owner
        )
          return;
        workspace.current = owner;
        stateRef.current = value;
        setLocal(value);
        setLoaded(true);
        const pending = await legacyAvailable();
        if (generation === workspaceGeneration.current) {
          setHasLegacy(pending);
          setLegacyDeferred(false);
        }
      })
      .catch((e) => {
        if (generation === workspaceGeneration.current)
          setNotice(m("errors.loadLibrary", { reason: errorMessage(e) }));
      });
    return () => {
      if (workspaceGeneration.current === generation)
        workspaceGeneration.current++;
    };
  }, [authReady, auth?.user.id, loadRetry]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (value) => {
      activityRef.current = value === "active";
      setActive(value === "active");
      if (value === "active") backend?.auth.startAutoRefresh();
      else backend?.auth.stopAutoRefresh();
      if (value !== "active") {
        pauseReading();
      }
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!playing || !active || mode !== "words" || !current) return;
    const pos = current.position;
    const word = current.words[pos];
    if (!word) {
      setPlaying(false);
      return;
    }
    if (chapterTransition) {
      playbackClock.current.schedule(() => setChapterTransition(false), 2000);
      return () => playbackClock.current.cancel();
    }
    const duration = delay(word, wpm);
    playbackClock.current.schedule(() => {
      if (!activityRef.current) return;
      elapsedRef.current += duration;
      setElapsed(elapsedRef.current);
      setSessionWords((n) => n + 1);
      if (auth) {
        if (!chunk.current)
          chunk.current = {
            id: Crypto.randomUUID(),
            owner: auth.user.id,
            hash: current.hash,
            total: current.words.length,
            positions: [],
            wpm,
            activeMs: 0,
          };
        chunk.current.positions.push(pos);
        chunk.current.activeMs += duration;
      }
      if (chapterWait(current.chapterStarts, pos)) setChapterTransition(true);
      update(
        (v) => ({
          ...v,
          queue: chunk.current
            ? [
                ...v.queue.filter((q) => q.id !== chunk.current!.id),
                { ...chunk.current, positions: [...chunk.current.positions] },
              ]
            : v.queue,
          documents: v.documents.map((d) => {
            if (d.hash !== current.hash) return d;
            const next = {
              ...wordPosition(d, Math.min(pos + 1, d.words.length - 1)),
              seen: d.seen.includes(pos) ? d.seen : [...d.seen, pos],
            };
            return {
              ...next,
              completed: !!d.completed || progress(next).complete,
            };
          }),
        }),
        false,
      );
      if (pos === current.words.length - 1) {
        setPlaying(false);
        flush();
        setNotice(
          progress(
            stateRef.current.documents.find((d) => d.hash === current.hash)!,
          ).complete
            ? m("reader.complete")
            : m("reader.incomplete"),
        );
      } else if ((chunk.current?.positions.length || 0) >= 25) flush();
    }, duration);
    return () => {
      playbackClock.current.cancel();
    };
  }, [
    playing,
    chapterTransition,
    active,
    mode,
    current?.position,
    current?.hash,
    wpm,
    auth?.user.id,
  ]);
  syncLatest.current = sync;
  useEffect(() => {
    if (
      !auth ||
      !loaded ||
      !authReady ||
      recovery ||
      !active ||
      migration ||
      upgradesPending
    )
      return;
    const owner = auth.user.id;
    const controller = new AutoSync(
      async () => {
        await syncInFlight.current?.catch(() => {});
        if (
          autoSync.current !== controller ||
          authOwner.current !== owner ||
          !activityRef.current
        )
          return;
        const task = syncLatest.current();
        syncInFlight.current = task;
        try {
          await task;
        } finally {
          if (syncInFlight.current === task) syncInFlight.current = null;
        }
      },
      (error) =>
        setSyncError(m("errors.sync", { reason: errorMessage(error) })),
      () => setSyncError(""),
    );
    autoSync.current = controller;
    void controller.request();
    return () => {
      controller.dispose();
      if (autoSync.current === controller) autoSync.current = null;
    };
  }, [
    auth?.user.id,
    loaded,
    authReady,
    recovery,
    active,
    migration,
    upgradesPending,
  ]);
  useEffect(() => {
    void autoSync.current?.request();
  }, [syncEpoch]);
  useEffect(() => {
    if (
      auth &&
      authReady &&
      !recovery &&
      active &&
      !current &&
      (tab === "ranking" || tab === "profile" || tab === "friends")
    ) {
      void autoSync.current?.request();
    }
  }, [tab, current?.hash, auth?.user.id, authReady, recovery, active]);
  async function refresh() {
    if (!auth) return;
    const owner = auth.user.id;
    setProfileError("");
    const results = await Promise.allSettled([
      rpc("list_friends", {}, owner),
      rpc("weekly_ranking", {}, owner),
      rpc("my_profile", {}, owner),
    ]);
    if (authOwner.current !== owner) return;
    const [f, r, p] = results;
    if (f.status === "fulfilled") setFriends(f.value || []);
    if (r.status === "fulfilled") setRanking(r.value || []);
    if (p.status === "fulfilled") setProfile(p.value?.[0] || null);
    else setProfileError(errorMessage(p.reason));
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
  }

  async function sync() {
    const owner = auth?.user.id;
    if (
      !owner ||
      workspace.current !== owner ||
      !loaded ||
      recovery ||
      migrationRef.current ||
      upgradesPending ||
      !activityRef.current ||
      syncLock.current
    )
      return;
    const generation = workspaceGeneration.current;
    const valid = () =>
      authOwner.current === owner &&
      workspace.current === owner &&
      workspaceGeneration.current === generation;
    syncLock.current = true;
    try {
      await writeLocal(stateRef.current, owner);
      let settled = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const reply = (await rpc("library_get", {}, owner)) as LibraryReply;
        if (!valid()) return;
        const merged = mergeLibrary(
          stateRef.current,
          reply,
          selectedRef.current,
        );
        update(() => merged, false);
        const outgoing = catalog(merged);
        if (sameCatalog(outgoing, reply.data)) {
          settled = true;
          break;
        }
        const ack = (await rpc(
          "library_put",
          { p_revision: reply.revision, p_data: outgoing },
          owner,
        )) as LibraryReply;
        if (!valid()) return;
        if (!ack.accepted) continue;
        update(
          (v) => ({ ...v, cloud: { revision: ack.revision, base: ack.data } }),
          false,
        );
        settled = true;
        if (!sameCatalog(catalog(stateRef.current), outgoing))
          void autoSync.current?.request();
        break;
      }
      if (!settled) throw new AppError("errors.catalogConcurrent");
      const registered = new Map<string, number>();
      for (const document of stateRef.current.documents) {
        if (!valid()) return;
        const total = totalWords(document);
        if (
          !total ||
          ((document.extractionVersion || 1) < EXTRACTION_VERSION &&
            !document.synced)
        )
          continue;
        const start = document.readingStart ?? 0;
        await rpc(
          "set_reading_start",
          { p_hash: document.hash, p_total: total, p_start: start },
          owner,
        );
        if (!valid()) return;
        registered.set(document.hash, start);
        update(
          (v) => ({
            ...v,
            documents: v.documents.map((d) =>
              d.hash === document.hash ? { ...d, synced: true } : d,
            ),
          }),
          false,
        );
      }
      const pending = sealedSessions(
        stateRef.current.queue,
        owner,
        chunk.current?.id,
      ).filter(
        (c) =>
          stateRef.current.documents.some(
            (d) =>
              d.hash === c.hash &&
              totalWords(d) === c.total &&
              registered.get(d.hash) === (d.readingStart ?? 0),
          ) ||
          stateRef.current.pendingDocuments?.some(
            (d) => d.hash === c.hash && totalWords(d) === c.total,
          ),
      );
      for (const c of pending) {
        if (!valid()) return;
        await rpc(
          "submit_session",
          {
            p_id: c.id,
            p_hash: c.hash,
            p_total: c.total,
            p_positions: c.positions,
            p_wpm: c.wpm,
            p_active_ms: Math.round(c.activeMs),
          },
          c.owner,
        );
        if (!valid()) return;
        update(
          (v) => ({ ...v, queue: v.queue.filter((q) => q.id !== c.id) }),
          false,
        );
      }
      if (valid()) await refresh();
    } finally {
      syncLock.current = false;
    }
  }
  async function importPdf(expectedHash?: string) {
    const generation = workspaceGeneration.current;
    const result = await Picker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if ((asset.size || 0) > 30 * 1024 * 1024)
      throw new AppError("errors.fileSize");
    const encoded = await FS.readAsStringAsync(asset.uri, {
      encoding: FS.EncodingType.Base64,
    });
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      encoded,
    );
    if (generation !== workspaceGeneration.current) return;
    checkImportedHash(hash, expectedHash);
    const existing = stateRef.current.documents.find((d) => d.hash === hash);
    if (existing && existing.available !== false) {
      openDocument(existing);
      return;
    }
    const uri = FS.documentDirectory + hash + ".pdf";
    await FS.copyAsync({ from: asset.uri, to: uri });
    if (generation !== workspaceGeneration.current) return;
    setProcessingProgress("");
    setImporting({ hash, uri, title: asset.name });
  }
  async function acceptExtraction(
    result: PdfExtraction,
    expectedGeneration: number,
  ) {
    if (expectedGeneration !== workspaceGeneration.current) return;
    const generation = workspaceGeneration.current;
    const owner = workspace.current;
    if (owner === undefined) return;
    if (migrationRef.current) {
      const hash = migrationRef.current;
      const document = stateRef.current.documents.find((d) => d.hash === hash);
      if (!document) {
        migrationRef.current = null;
        setMigration(null);
        return;
      }
      try {
        let preserve = !!document.synced;
        let deferred = false;
        const owner = authOwner.current;
        if (
          !preserve &&
          (document.extractionVersion || 1) < EXTRACTION_VERSION &&
          backend
        ) {
          if (
            !owner ||
            stateRef.current.queue.some(
              (c) => c.hash === hash && c.owner !== owner,
            )
          ) {
            preserve = true;
            deferred = true;
          } else {
            try {
              const registered = await rpc(
                "document_sync_state",
                { p_hash: hash },
                owner,
              );
              if (
                typeof registered !== "boolean" ||
                authOwner.current !== owner
              )
                throw new AppError("errors.syncCheck");
              preserve = registered;
            } catch {
              preserve = true;
              deferred = true;
            }
          }
        }
        if (generation !== workspaceGeneration.current) return;
        let nextDocument: Document;
        let queue = stateRef.current.queue;
        if (
          preserve ||
          (document.extractionVersion || 1) >= EXTRACTION_VERSION
        ) {
          nextDocument = addChapterMetadata(document, result);
          if (preserve && !deferred)
            nextDocument = { ...nextDocument, synced: true };
        } else {
          const migrated = migrateDocument(document, result);
          nextDocument = migrated.document;
          queue = migratePendingSessions(
            queue,
            hash,
            migrated.sources,
            nextDocument.words.length,
          );
        }
        const next = {
          ...stateRef.current,
          queue,
          documents: stateRef.current.documents.map((d) =>
            d.hash === hash ? nextDocument : d,
          ),
        };
        await writeLocal(next, owner);
        if (generation !== workspaceGeneration.current) return;
        stateRef.current = next;
        setLocal(next);
        if (deferred) {
          setMigrationFailures((v) => [...v, hash]);
          setNotice(m("errors.chapterDeferred"));
        }
      } catch (e) {
        if (generation !== workspaceGeneration.current) return;
        setMigrationFailures((v) => [...v, hash]);
        setNotice(m("errors.extractionPreserved", { reason: errorMessage(e) }));
      } finally {
        if (generation !== workspaceGeneration.current) return;
        migrationRef.current = null;
        setMigration(null);
        setProcessingProgress("");
      }
      return;
    }
    if (!importing) return;
    const existing = stateRef.current.documents.find(
      (d) => d.hash === importing.hash,
    );
    const version = existing?.extractionVersion || result.extractionVersion;
    const extracted =
      version === 2 ? result.legacy : version === 1 ? result.original : result;
    if (
      !extracted ||
      (existing && extracted.words.length !== totalWords(existing))
    ) {
      setImporting(null);
      throw new AppError("errors.extractionHistory");
    }
    const document: Document = {
      ...importing,
      originalTitle: importing.title,
      title: normalizeTitle(importing.title),
      words: extracted.words,
      wordCount: extracted.words.length,
      available: true,
      pageCount: result.pageCount,
      extractionVersion: version,
      chapterStarts: extracted.chapterStarts || [],
      chapterDetectionVersion: CHAPTER_DETECTION_VERSION,
      readingStart: 0,
      position: 0,
      legacyPosition: 0,
      localResumeValid: false,
      resumePage: 1,
      seen: [],
      libraryOrder:
        Math.max(
          -1,
          ...stateRef.current.documents.map((d, i) => orderValue(d, i)),
        ) + 1,
    };
    if (existing)
      Object.assign(document, attachFile(existing, result, importing.uri));
    update((v) => ({
      ...v,
      documents: existing
        ? v.documents.map((d) => (d.hash === document.hash ? document : d))
        : [...v.documents, document],
    }));
    setImporting(null);
    if (existing) openDocument(document);
    else setCoverRequest({ hash: document.hash, initial: true, generation });
    setSyncEpoch((n) => n + 1);
    setProcessingProgress("");
  }
  function openDocument(d: Document) {
    const latest = stateRef.current.documents.find((v) => v.hash === d.hash);
    if (!latest || latest.available === false) return;
    setPdfPage(resumePage(latest));
    setSelected(latest.hash);
    setMode("pdf");
  }
  function offerLegacyClaim() {
    const owner = auth?.user.id;
    if (!owner || workspace.current !== owner) return;
    Alert.alert(
      t("library.legacyTitle"),
      t("library.legacyBody", { email: auth?.user.email || "" }),
      [
        {
          text: t("library.legacyLater"),
          style: "cancel",
          onPress: () => setLegacyDeferred(true),
        },
        {
          text: t("library.legacyConfirm"),
          onPress: () =>
            void action(async () => {
              const generation = workspaceGeneration.current;
              const value = await claimLegacy(owner, stateRef.current);
              if (generation !== workspaceGeneration.current) return;
              stateRef.current = value;
              setLocal(value);
              setHasLegacy(false);
              setSyncEpoch((n) => n + 1);
            }),
        },
      ],
    );
  }
  function confirmReadingStart(start: number, defineStart = false) {
    if (!current) return;
    pauseReading();
    update((v) => ({
      ...v,
      documents: v.documents.map((d) =>
        d.hash === current.hash
          ? {
              ...wordPosition(d, start, true),
              readingStart: defineStart ? start : d.readingStart,
              completed:
                !!d.completed ||
                progress({
                  ...d,
                  readingStart: defineStart ? start : d.readingStart,
                }).complete,
            }
          : d,
      ),
    }));
    setSyncEpoch((n) => n + 1);
    setChoosingStart(false);
    setMode("words");
  }
  function leave() {
    pauseReading();
    setSelected(null);
    setSessionWords(0);
    elapsedRef.current = 0;
    setElapsed(0);
  }
  function navigate(step: number) {
    pauseReading();
    if (current)
      update((v) => ({
        ...v,
        queue: chunk.current
          ? [
              ...v.queue.filter((q) => q.id !== chunk.current!.id),
              { ...chunk.current, positions: [...chunk.current.positions] },
            ]
          : v.queue,
        documents: v.documents.map((d) =>
          d.hash === current.hash
            ? {
                ...wordPosition(d, d.position + step),
              }
            : d,
        ),
      }));
  }
  const field = (
    placeholder: string,
    value: string,
    set: (v: string) => void,
    secure = false,
  ) => (
    <TextInput
      accessibilityLabel={placeholder}
      placeholder={placeholder}
      value={value}
      onChangeText={set}
      secureTextEntry={secure}
      autoCapitalize="none"
      style={s.input}
    />
  );
  if (!languageReady)
    return (
      <SafeAreaView style={s.root}>
        <ActivityIndicator color={colors.wine} />
      </SafeAreaView>
    );
  if (!loaded || !authReady)
    return (
      <SafeAreaView style={s.root}>
        <Text style={s.title}>{t("library.loading")}</Text>
        {notice ? (
          <>
            <Text style={s.muted}>{renderMessage(notice)}</Text>
            <Button
              label={t("common.retry")}
              onPress={() => setLoadRetry((n) => n + 1)}
            />
          </>
        ) : null}
      </SafeAreaView>
    );
  const syncFailure = syncError ? (
    <View
      style={[
        s.card,
        current &&
          mode === "words" && {
            backgroundColor: palette.soft,
            borderColor: palette.border,
          },
      ]}
    >
      <Text
        style={[s.muted, current && mode === "words" && { color: palette.ink }]}
        accessibilityLiveRegion="polite"
      >
        {renderMessage(syncError)}
      </Text>
      <Button
        secondary
        label={t("common.retry")}
        onPress={() => void autoSync.current?.request(true)}
      />
    </View>
  ) : null;
  if (current && mode === "words" && !processing) {
    return (
      <ReaderPaletteContext.Provider value={palette}>
        <WordReader
          title={current.title}
          word={current.words[current.position]?.text || ""}
          playing={playing}
          chapterTransition={chapterTransition}
          context={
            !playing && (current.position > 0 || current.seen.length > 0)
              ? getReadingContext(current.words, current.position)
              : ""
          }
          font={font}
          background={palette.background}
          onPause={pauseReading}
          onPlay={() => setPlaying(true)}
          onBack={() => {
            pauseReading();
            setPdfPage(current.words[current.position]?.page || 1);
            setMode("pdf");
          }}
          onPrevious={() => navigate(-1)}
          onNext={() => navigate(1)}
          previousDisabled={current.position === 0}
          nextDisabled={current.position === current.words.length - 1}
        >
          <Text style={[s.muted, { color: palette.muted }]}>
            {t("reader.sessionStats", {
              page: current.words[current.position]?.page || 1,
              percent: formatPercent(progress(current).percent),
              words: t("library.wordCount", { count: sessionWords }),
              minutes: Math.floor(elapsed / 60000),
            })}
          </Text>
          <View style={s.row}>
            <Button
              secondary
              label="− 25"
              onPress={() => {
                pauseReading();
                setWpm(Math.max(100, wpm - 25));
              }}
            />
            <Text style={[s.body, { color: palette.ink }]}>
              {t("reader.speed", { speed: wpm })}
            </Text>
            <Button
              secondary
              label="+ 25"
              onPress={() => {
                pauseReading();
                setWpm(Math.min(800, wpm + 25));
              }}
            />
            <Button
              secondary
              label="A−"
              accessibilityLabel={t("reader.smallerFont")}
              onPress={() => setFont(Math.max(24, font - 4))}
            />
            <Button
              secondary
              label="A+"
              accessibilityLabel={t("reader.largerFont")}
              onPress={() => setFont(Math.min(64, font + 4))}
            />
          </View>

          <Text style={[s.muted, { color: palette.muted }]}>
            {!eligible(wpm, true)
              ? t("reader.noScore")
              : auth
                ? ""
                : t("reader.signInToScore")}
          </Text>
          {syncFailure}
          {notice ? (
            <TouchableOpacity onPress={() => setNotice("")}>
              <Text style={[s.notice, { color: palette.ink }]}>
                {renderMessage(notice)}
              </Text>
            </TouchableOpacity>
          ) : null}
        </WordReader>
      </ReaderPaletteContext.Provider>
    );
  }
  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="dark" hidden={false} />
      {!current && (
        <View style={s.header}>
          <Text style={s.logo}>
            PDFast<Text style={{ color: colors.gold }}> Reader</Text>
          </Text>
        </View>
      )}
      {syncFailure}
      {auth && hasLegacy && !legacyDeferred && !current && (
        <View style={s.card}>
          <Text style={s.body}>{t("library.legacyBanner")}</Text>
          <Button label={t("library.legacyLink")} onPress={offerLegacyClaim} />
          <Button
            secondary
            label={t("library.legacyLater")}
            onPress={() => setLegacyDeferred(true)}
          />
        </View>
      )}
      {notice ? (
        <TouchableOpacity onPress={() => setNotice("")}>
          <Text style={s.notice}>{renderMessage(notice)}</Text>
        </TouchableOpacity>
      ) : null}
      {processing ? (
        <View style={s.readerContent}>
          <Text style={s.title}>
            {migration ? t("reader.upgrading") : t("reader.preparing")}
          </Text>
          <Text style={s.muted}>
            {renderMessage(processingProgress) || t("reader.analyzing")}
          </Text>
          <PdfView
            key={`${renderGeneration}:${processing.hash}`}
            uri={processing.uri}
            page={1}
            extract
            onExtract={(result) =>
              void acceptExtraction(result, renderGeneration).catch((e) =>
                Alert.alert(t("reader.extractPreserved"), message(e)),
              )
            }
            onProgress={(page, total) =>
              setProcessingProgress(m("reader.pageOf", { page, total }))
            }
            onError={(m) => {
              if (migration) {
                setMigrationFailures((v) => [...v, migration]);
                migrationRef.current = null;
                setMigration(null);
                Alert.alert(t("reader.originalPreserved"), renderMessage(m));
              } else if (importing) {
                const uri = importing.uri;
                setImporting(null);
                void FS.deleteAsync(uri, { idempotent: true });
                Alert.alert(t("reader.importFailed"), renderMessage(m));
              }
            }}
          />
        </View>
      ) : current ? (
        <>
          <PdfPageReader
            key={current.hash}
            document={current}
            page={pdfPage}
            onChangePage={(page) => {
              setPdfPage(page);
              update((v) => ({
                ...v,
                documents: v.documents.map((d) =>
                  d.hash === current.hash ? bookmark(d, page) : d,
                ),
              }));
            }}
            onBack={leave}
            onChooseStart={() => {
              pauseReading();
              setChoosingStart(true);
            }}
            onPageCount={(pages) => {
              if (current.pageCount !== pages)
                update((v) => ({
                  ...v,
                  documents: v.documents.map((d) =>
                    d.hash === current.hash ? { ...d, pageCount: pages } : d,
                  ),
                }));
            }}
            onError={setNotice}
          />
          {choosingStart && (
            <SentencePicker
              key={`${current.hash}:${pdfPage}`}
              document={current}
              page={pdfPage}
              onCancel={() => setChoosingStart(false)}
              onConfirm={confirmReadingStart}
              resumePosition={localResume(current, pdfPage)}
            />
          )}
        </>
      ) : (
        <SwipeTabs
          enabled={
            !managingProfile &&
            !settings &&
            !recovery &&
            !renameHash &&
            !coverRequest &&
            !libraryInteraction
          }
          index={tabs.indexOf(tab)}
          request={tabRequest}
          onChange={commitSwipe}
        >
          {tabs.map((pageTab) => (
            <ScrollView
              key={`${workspace.current || "guest"}:${pageTab}`}
              ref={(view) => {
                tabScrollRefs.current[pageTab] = view;
                if (pageTab === tab && view) mainScroll.current = view;
              }}
              onScroll={(event) => {
                if (pageTab !== tab) return;
                scrollOffset.current = event.nativeEvent.contentOffset.y;
                if (!managingProfile && !settings && !pendingTabScroll.current)
                  tabOffsets.current[pageTab] = scrollOffset.current;
              }}
              scrollEventThrottle={16}
              contentContainerStyle={s.content}
              automaticallyAdjustKeyboardInsets
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
            >
              {pageTab === "library" ? (
                <Library
                  key={workspace.current || "guest"}
                  owner={workspace.current || null}
                  scrollRef={mainScroll}
                  scrollOffset={scrollOffset}
                  onInteraction={setLibraryInteraction}
                  onCover={(d) =>
                    setCoverRequest({
                      hash: d.hash,
                      initial: false,
                      generation: workspaceGeneration.current,
                    })
                  }
                  local={local}
                  busy={busy}
                  onUpdate={update}
                  onImport={() => void action(() => importPdf())}
                  onOpen={openDocument}
                  onLocate={(d) => void action(() => importPdf(d.hash))}
                  onRename={setRenameHash}
                />
              ) : pageTab === "profile" ? (
                <>
                  {settings ? (
                    <Settings
                      value={appearance.colors}
                      onChange={appearance.save}
                      onBack={() => setSettings(false)}
                    />
                  ) : (
                    <>
                      {auth && !recovery && managingProfile ? null : (
                        <Text style={s.title}>
                          {profile?.username
                            ? `@${profile.username}`
                            : t("tabs.profile")}
                        </Text>
                      )}
                      {auth && !recovery && !managingProfile && (
                        <Text style={s.body}>{auth.user.email}</Text>
                      )}
                      {auth && !recovery && managingProfile ? (
                        <ManageProfile
                          externalBusy={busy}
                          key={auth.user.id}
                          user={auth.user}
                          username={profile?.username ?? null}
                          onBack={() => setManagingProfile(false)}
                          onProfile={refresh}
                          onPageChange={() => {
                            mainScroll.current?.scrollTo({
                              y: 0,
                              animated: false,
                            });
                            scrollOffset.current = 0;
                          }}
                          onSignOut={() =>
                            void action(async () => {
                              flush();
                              const result = await backend?.auth.signOut({
                                scope: "local",
                              });
                              if (result?.error) throw result.error;
                              setProfile(null);
                              setRanking([]);
                              setFriends([]);
                            })
                          }
                          onDelete={() =>
                            Alert.alert(
                              t("profile.deleteTitle"),
                              t("profile.deleteBody"),
                              [
                                { text: t("common.cancel"), style: "cancel" },
                                {
                                  text: t("common.delete"),
                                  style: "destructive",
                                  onPress: () =>
                                    void action(async () => {
                                      pauseReading();
                                      autoSync.current?.dispose();
                                      workspaceGeneration.current++;
                                      try {
                                        await rpc(
                                          "delete_account",
                                          {},
                                          auth.user.id,
                                        );
                                        await clearWorkspace(auth.user.id);
                                        clearShelfOffsets(auth.user.id);
                                        stateRef.current = empty;
                                        setLocal(empty);
                                        const result =
                                          await backend?.auth.signOut({
                                            scope: "local",
                                          });
                                        if (result?.error) throw result.error;

                                        setProfile(null);
                                        setRanking([]);
                                        setFriends([]);
                                      } catch (e) {
                                        setLoadRetry((n) => n + 1);
                                        throw e;
                                      }
                                    }),
                                },
                              ],
                            )
                          }
                        />
                      ) : (
                        <>
                          {auth && hasLegacy && legacyDeferred && (
                            <Button
                              secondary
                              label={t("library.legacyLink")}
                              onPress={offerLegacyClaim}
                            />
                          )}
                          <View style={s.card}>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "baseline",
                                gap: 10,
                                flexWrap: "wrap",
                              }}
                            >
                              <Text
                                systemFont
                                style={{
                                  fontSize: 32,
                                  fontWeight: "700",
                                  fontVariant: ["tabular-nums"],
                                  color: colors.ink,
                                }}
                              >
                                {
                                  local.documents.filter(
                                    (d) => d.completed || progress(d).complete,
                                  ).length
                                }
                              </Text>
                              <Text style={s.body}>
                                {t("profile.completedLabel", {
                                  count: local.documents.filter(
                                    (d) => d.completed || progress(d).complete,
                                  ).length,
                                })}
                              </Text>
                            </View>
                            <Text style={s.body}>
                              {t("profile.presentedWords", {
                                count: local.documents.reduce(
                                  (n, d) => n + d.seen.length,
                                  0,
                                ),
                              })}
                            </Text>
                            <Text style={s.muted}>
                              {t("profile.comprehension")}
                            </Text>
                          </View>
                          {!auth || recovery ? (
                            <AuthPanel
                              recovery={recovery}
                              onRecovered={() => {
                                void recoveryState.clear();
                                setRecovery(false);
                              }}
                              needsUsername={false}
                              onProfile={refresh}
                            />
                          ) : (
                            <>
                              {profileState(
                                profile,
                                renderMessage(profileError),
                              ) === "needsUsername" && (
                                <AuthPanel
                                  recovery={false}
                                  onRecovered={() => {}}
                                  needsUsername
                                  onProfile={refresh}
                                />
                              )}
                              {!profile && (
                                <>
                                  <Text style={s.muted}>
                                    {renderMessage(profileError) ||
                                      t("profile.loading")}
                                  </Text>
                                  <Button
                                    label={t("common.retry")}
                                    onPress={() => void action(refresh)}
                                  />
                                </>
                              )}
                            </>
                          )}
                          <Button
                            secondary
                            label={t("settings.title")}
                            onPress={() => setSettings(true)}
                          />
                          {auth && !recovery && (
                            <Button
                              secondary
                              label={t("profile.manage")}
                              onPress={() => setManagingProfile(true)}
                            />
                          )}
                          <Text style={s.muted}>{t("profile.deviceHint")}</Text>
                        </>
                      )}
                    </>
                  )}
                </>
              ) : !auth || recovery ? (
                <>
                  <Text style={s.title}>{t(`tabs.${pageTab}`)}</Text>
                  <Text style={s.body}>{t("friends.signInHint")}</Text>
                  <Button
                    label={t("friends.goProfile")}
                    onPress={() => changeTab("profile")}
                  />
                </>
              ) : pageTab === "friends" ? (
                <>
                  {field(t("friends.search"), search, setSearch)}
                  <Button
                    label={t("common.search")}
                    onPress={() =>
                      void action(async () =>
                        setResults(
                          (await rpc("search_profiles", { p_query: search })) ||
                            [],
                        ),
                      )
                    }
                  />
                  {results.map((p) => (
                    <View key={p.id} style={s.card}>
                      <Text style={s.section}>@{p.username}</Text>
                      <Button
                        secondary
                        label={t("friends.invite")}
                        onPress={() =>
                          void action(async () => {
                            await rpc("request_friend", { p_target: p.id });
                            await refresh();
                          })
                        }
                      />
                    </View>
                  ))}
                  {friends.map((f) => (
                    <View key={f.id} style={s.card}>
                      <Text style={s.section}>@{f.username}</Text>
                      <Text style={s.muted}>
                        {f.status === "accepted"
                          ? t("common.friend")
                          : f.incoming
                            ? t("friends.received")
                            : t("friends.sent")}
                      </Text>
                      {f.incoming && f.status === "pending" && (
                        <Button
                          label={t("common.accept")}
                          onPress={() =>
                            void action(async () => {
                              await rpc("respond_friend", {
                                p_id: f.id,
                                p_accept: true,
                              });
                              await refresh();
                            })
                          }
                        />
                      )}
                      <Button
                        secondary
                        label={
                          f.status === "accepted"
                            ? t("friends.remove")
                            : t("friends.decline")
                        }
                        onPress={() =>
                          void action(async () => {
                            await rpc("remove_friend", { p_id: f.id });
                            await refresh();
                          })
                        }
                      />
                    </View>
                  ))}
                </>
              ) : (
                <>
                  <Text style={s.title}>{t("ranking.title")}</Text>
                  <Text style={s.muted}>
                    {t("ranking.ends", { date: formatDate(nextWeek(), true) })}
                  </Text>
                  <Button
                    label={t("ranking.refresh")}
                    onPress={() => void autoSync.current?.request(true)}
                  />
                  {ranking.map((r) => (
                    <View key={r.id} style={s.card}>
                      <Text style={s.section}>
                        {t("ranking.entry", {
                          place: ordinal(r.placement),
                          username: r.username,
                        })}
                      </Text>
                      <Text style={s.body}>
                        {t("profile.validWords", { count: Number(r.words) })}
                      </Text>
                    </View>
                  ))}
                  <Text style={s.body}>{t("ranking.rewardHint")}</Text>
                  <Text style={s.muted}>{t("ranking.friendsHint")}</Text>
                  <Button
                    secondary
                    label={t("ranking.medals")}
                    onPress={() =>
                      void action(async () => {
                        const rewards = await rpc("my_rewards");
                        Alert.alert(
                          t("common.medals"),
                          rewards?.length
                            ? rewards
                                .map((r: any) =>
                                  t("ranking.medalEntry", {
                                    place: ordinal(r.placement),
                                    date: formatDate(r.week),
                                  }),
                                )
                                .join("\n")
                            : t("ranking.emptyMedals"),
                        );
                      })
                    }
                  />
                </>
              )}
            </ScrollView>
          ))}
        </SwipeTabs>
      )}
      {coverRequest &&
        local.documents.some((d) => d.hash === coverRequest.hash) && (
          <CoverChooser
            key={`${workspace.current}:${coverRequest.hash}`}
            document={local.documents.find(
              (d) => d.hash === coverRequest.hash,
            )!}
            owner={workspace.current || null}
            initial={coverRequest.initial}
            onCancel={() => {
              const request = coverRequest;
              setCoverRequest(null);
              if (request.initial) {
                const d = stateRef.current.documents.find(
                  (d) => d.hash === request.hash,
                );
                if (d) {
                  openDocument(d);
                  setPdfPage(1);
                }
              }
            }}
            onSave={(choice) => {
              if (coverRequest.generation !== workspaceGeneration.current)
                return;
              const request = coverRequest;
              update((v) => ({
                ...v,
                documents: v.documents.map((d) =>
                  d.hash === request.hash ? { ...d, ...choice } : d,
                ),
              }));
              setCoverRequest(null);
              if (request.initial) {
                const d = stateRef.current.documents.find(
                  (d) => d.hash === request.hash,
                );
                if (d) {
                  openDocument(d);
                  setPdfPage(1);
                }
              }
            }}
          />
        )}
      {renameDocument && (
        <RenameDocument
          key={renameDocument.hash}
          title={renameDocument.title}
          onCancel={() => setRenameHash(null)}
          onSave={(title) => {
            update((v) => ({
              ...v,
              documents: v.documents.map((d) =>
                d.hash === renameDocument.hash
                  ? { ...d, title, customTitle: true }
                  : d,
              ),
            }));
            setRenameHash(null);
          }}
        />
      )}
      {!current && !processing && (
        <View style={s.nav}>
          {tabs.map((tabId) => (
            <TouchableOpacity
              key={tabId}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === tabId }}
              onPress={() => changeTab(tabId)}
              style={s.navItem}
            >
              <Text
                style={{
                  color: tab === tabId ? colors.wine : colors.muted,
                  fontWeight: tab === tabId ? "800" : "400",
                }}
              >
                {t(`tabs.${tabId}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: {
    paddingVertical: 22,
    paddingHorizontal: TAB_SIDE_PADDING,
    paddingBottom: 12,
  },
  logo: {
    fontFamily: serif,
    fontSize: 25,
    fontWeight: "800",
    color: colors.ink,
  },
  content: {
    flexGrow: 1,
    paddingVertical: 22,
    paddingHorizontal: TAB_SIDE_PADDING,
    gap: 14,
  },
  readerContent: { flex: 1, minHeight: 0, padding: 22, gap: 14 },
  title: {
    fontFamily: serif,
    fontSize: 28,
    fontWeight: "700",
    color: colors.ink,
    lineHeight: 35,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    color: colors.blue,
    fontWeight: "700",
  },
  section: {
    fontFamily: serif,
    fontSize: 19,
    fontWeight: "700",
    color: colors.ink,
  },
  body: { fontSize: 16, lineHeight: 25, color: colors.ink },
  muted: { fontSize: 13, lineHeight: 20, color: colors.muted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 22,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.wine,
    minHeight: 48,
    justifyContent: "center",
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  secondary: { backgroundColor: colors.soft },
  buttonText: { color: colors.white, fontSize: 14, fontWeight: "700" },
  input: {
    backgroundColor: colors.white,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
    flexWrap: "wrap",
  },
  nav: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  navItem: {
    flex: 1,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
  },
  notice: { backgroundColor: colors.soft, padding: 12, color: colors.ink },
  track: { height: 5, backgroundColor: colors.soft, borderRadius: 4 },
  fill: { height: 5, backgroundColor: colors.gold, borderRadius: 4 },
});
