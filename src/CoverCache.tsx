import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import * as FS from "expo-file-system/legacy";
import type { Document } from "./core";
import { PdfView } from "./PdfView";
import { coverPath, pageCoverFile, writeThumbnail } from "./coverFiles";
export function CoverCache({
  documents,
  owner,
  onRefresh,
  request = 0,
}: {
  documents: Document[];
  owner: string | null;
  onRefresh: () => void;
  request?: number;
}) {
  const [job, setJob] = useState<Document | null>(null),
    [epoch, setEpoch] = useState(0);
  const failed = useRef(new Set<string>()),
    writing = useRef(false),
    alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  useEffect(() => {
    let cancelled = false;
    if (job) return;
    void (async () => {
      for (const d of documents) {
        const key = d.hash + ":" + d.coverPage;
        if (
          !d.coverPage ||
          d.customCover ||
          d.available === false ||
          failed.current.has(key)
        )
          continue;
        const exists = await FS.getInfoAsync(
          coverPath(pageCoverFile(owner, d.hash, d.coverPage)),
        );
        if (cancelled) return;
        if (!exists.exists) {
          setJob(d);
          return;
        }
      }
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [documents, owner, epoch, job, request]);
  if (!job) return null;
  const finish = () => {
    if (alive.current) {
      writing.current = false;
      setJob(null);
      setEpoch((n) => n + 1);
    }
  };
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        opacity: 0,
        overflow: "hidden",
      }}
    >
      <PdfView
        key={job.hash + ":" + job.coverPage}
        uri={job.uri}
        page={job.coverPage!}
        thumbnail
        onThumbnail={(page, b64) => {
          if (writing.current || page !== job.coverPage) return;
          writing.current = true;
          void writeThumbnail(owner, job.hash, page, b64)
            .then(() => {
              if (alive.current) onRefresh();
            })
            .catch(() => failed.current.add(job.hash + ":" + job.coverPage))
            .finally(finish);
        }}
        onError={() => {
          failed.current.add(job.hash + ":" + job.coverPage);
          finish();
        }}
      />
    </View>
  );
}
