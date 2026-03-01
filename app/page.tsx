"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, CardBody, Chip, Input, Tooltip } from "@heroui/react";
import { motion } from "framer-motion";
import {
  FiAward,
  FiChevronsDown,
  FiChevronsUp,
  FiCloud,
  FiCloudOff,
  FiEye,
  FiLoader,
  FiSmile,
  FiStar,
  FiTarget,
  FiType,
} from "react-icons/fi";
import Image from "next/image";
import { get as idbGet, set as idbSet } from "idb-keyval";

type BoardItemKind = "goal" | "win" | "focus" | "northstar" | "image" | "stamp" | "text";

type BoardItem = {
  id: string;
  kind: BoardItemKind;
  text: string;
  imageSrc?: string;
  imageRatio?: number;
  textColor?: string;
  textSize?: number;
  textBold?: boolean;
  textItalic?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  tilt: number;
};

type BoardData = {
  title: string;
  ownerName: string;
  isPublic: boolean;
  credits: number;
  items: BoardItem[];
};

const CURRENT_YEAR = new Date().getFullYear();
const CANVAS_WIDTH = 2800;
const CANVAS_HEIGHT = 1800;
let idCounter = 1;
const STAMP_SET = ["💖", "👍", "⭐", "🔥", "👀", "✅", "🎯", "🚀", "💡", "🎉", "💰", "❓"];
const TEXT_COLORS = ["#0f172a", "#2563eb", "#dc2626", "#16a34a", "#7c3aed"];
const TEXT_SIZES = [16, 24, 32, 40];
const STARTER_GIF_SRC = "/starter-cat.gif";

function storageKey(year: number) {
  return `vision-board-${year}`;
}

function defaultBoard(year: number): BoardData {
  void year;
  return {
    title: "2026 visionBoard",
    ownerName: "Mohamed Reda",
    isPublic: false,
    credits: 50,
    items: [
      { id: "stamp-15", kind: "stamp", text: "\uD83D\uDC40", x: 1086, y: 292, width: 95, height: 95, tilt: 0 },
      { id: "stamp-13", kind: "stamp", text: "\uD83C\uDFAF", x: 175, y: 124, width: 87, height: 87, tilt: 0 },
      {
        id: "text-5",
        kind: "text",
        text: "Hello World, I can\nbuild anything i want",
        textColor: "#7c3aed",
        textSize: 40,
        textBold: true,
        textItalic: false,
        x: 672,
        y: 331,
        width: 420,
        height: 138,
        tilt: 0,
      },
      { id: "goal-9", kind: "goal", text: "new goal", x: 220, y: 172, width: 426, height: 131, tilt: 1 },
      { id: "focus-11", kind: "focus", text: "new focus", x: 665, y: 172, width: 423, height: 131, tilt: 2 },
      { id: "win-12", kind: "win", text: "new win", x: 219, y: 322, width: 426, height: 131, tilt: -3 },
      {
        id: "northstar-7",
        kind: "northstar",
        text: "your north star",
        x: 540,
        y: 16,
        width: 230,
        height: 139,
        tilt: -1,
      },
      { id: "stamp-14", kind: "stamp", text: "", x: 771, y: 61, width: 100, height: 100, tilt: 0 },
      { id: "stamp-17", kind: "stamp", text: "\uD83C\uDF89", x: 618, y: 421, width: 51, height: 51, tilt: 0 },
      {
        id: "image-18",
        kind: "image",
        text: "",
        imageSrc: STARTER_GIF_SRC,
        imageRatio: 1.0596026490066226,
        x: 899,
        y: 23,
        width: 133,
        height: 125,
        tilt: 0,
      },
      { id: "stamp-16", kind: "stamp", text: "\uD83D\uDE80", x: 191, y: 126, width: 56, height: 56, tilt: 0 },
    ],
  };
}

function loadBoard(year: number): BoardData {
  if (typeof window === "undefined") return defaultBoard(year);
  const raw = localStorage.getItem(storageKey(year));
  if (!raw) return defaultBoard(year);

  try {
    const parsed = JSON.parse(raw) as BoardData;
    return {
      ...defaultBoard(year),
      ...parsed,
      items: Array.isArray(parsed.items)
        ? parsed.items.map((item) => ({
            ...item,
            width: typeof item.width === "number" ? item.width : 180,
            height: typeof item.height === "number" ? item.height : 180,
            imageRatio: typeof item.imageRatio === "number" ? item.imageRatio : undefined,
            textColor: typeof item.textColor === "string" ? item.textColor : "#0f172a",
            textSize: typeof item.textSize === "number" ? item.textSize : 26,
            textBold: Boolean(item.textBold),
            textItalic: Boolean(item.textItalic),
          }))
        : defaultBoard(year).items,
    };
  } catch {
    return defaultBoard(year);
  }
}

function normalizeBoard(data: BoardData, year: number): BoardData {
  return {
    ...defaultBoard(year),
    ...data,
    items: Array.isArray(data.items)
      ? data.items.map((item) => ({
          ...item,
          width: typeof item.width === "number" ? item.width : 180,
          height: typeof item.height === "number" ? item.height : 180,
          imageRatio: typeof item.imageRatio === "number" ? item.imageRatio : undefined,
          textColor: typeof item.textColor === "string" ? item.textColor : "#0f172a",
          textSize: typeof item.textSize === "number" ? item.textSize : 26,
          textBold: Boolean(item.textBold),
          textItalic: Boolean(item.textItalic),
        }))
      : defaultBoard(year).items,
  };
}

function noteStyle(kind: BoardItemKind) {
  if (kind === "northstar") return "bg-amber-100 border-amber-300";
  if (kind === "goal") return "bg-rose-100 border-rose-300";
  if (kind === "win") return "bg-emerald-100 border-emerald-300";
  if (kind === "image" || kind === "stamp" || kind === "text") return "";
  return "bg-sky-100 border-sky-200";
}

function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function syncIdCounter(items: BoardItem[]) {
  const maxSeen = items.reduce((max, item) => {
    const match = item.id.match(/-(\d+)$/);
    if (!match) return max;
    const n = Number(match[1]);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 1);
  if (maxSeen > idCounter) idCounter = maxSeen;
}

function kindLabel(kind: BoardItemKind) {
  if (kind === "goal") return "goal";
  if (kind === "win") return "win";
  if (kind === "northstar") return "north star";
  if (kind === "image") return "image";
  if (kind === "stamp") return "stamp";
  if (kind === "text") return "text";
  return "focus";
}

function readEditableText(node: HTMLElement) {
  return node.innerText.replace(/\r\n/g, "\n");
}

export default function Home() {
  const selectedYear = CURRENT_YEAR;
  const [board, setBoard] = useState<BoardData>(() => defaultBoard(CURRENT_YEAR));
  const [isHydrated, setIsHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"unsaved" | "saving" | "saved" | "error">("saved");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingOwner, setIsEditingOwner] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [ownerDraft, setOwnerDraft] = useState("");
  const [activeTool, setActiveTool] = useState<"select" | "text">("select");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [isDragOverBoard, setIsDragOverBoard] = useState(false);
  const [isStampPickerOpen, setIsStampPickerOpen] = useState(false);
  const [failedImageIds, setFailedImageIds] = useState<string[]>([]);
  const [overflowingNoteIds, setOverflowingNoteIds] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const boardAreaRef = useRef<HTMLElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const ownerInputRef = useRef<HTMLInputElement | null>(null);
  const textDraftIdRef = useRef<string | null>(null);
  const boardRef = useRef<BoardData>(board);
  const selectedIdsRef = useRef<string[]>(selectedIds);
  const historyRef = useRef<BoardData[]>([]);
  const futureRef = useRef<BoardData[]>([]);
  const clipboardRef = useRef<BoardItem[]>([]);
  const marqueeRef = useRef<{
    startX: number;
    startY: number;
    additive: boolean;
    baseSelected: string[];
  } | null>(null);
  const resizeRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);
  const didLoadRef = useRef(false);
  const saveRunRef = useRef(0);
  const dragSessionRef = useRef<{
    ids: string[];
    startPointerX: number;
    startPointerY: number;
    starts: Record<string, { x: number; y: number; width: number; height: number }>;
  } | null>(null);
  const liveTextDraftsRef = useRef<Record<string, string>>({});
  const liveTextSaveTimerRef = useRef<number | null>(null);
  const noteBodyRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const stats = useMemo(() => {
    const goals = board.items.filter((item) => item.kind === "goal").length;
    const wins = board.items.filter((item) => item.kind === "win").length;
    const hasNorthStar = board.items.some((item) => item.kind === "northstar");
    const pct = goals === 0 ? 0 : Math.min(100, Math.round((wins / goals) * 100));
    return { goals, wins, pct, hasNorthStar };
  }, [board.items]);
  const focusedTextItem = useMemo(
    () => board.items.find((item) => item.id === editingTextId && item.kind === "text") ?? null,
    [board.items, editingTextId],
  );

  useEffect(() => {
    boardRef.current = board;
    syncIdCounter(board.items);
  }, [board]);

  const persistSilent = useCallback(async (next: BoardData, year = selectedYear) => {
    let localOk = false;
    try {
      localStorage.setItem(storageKey(year), JSON.stringify(next));
      localOk = true;
    } catch {
      // LocalStorage might hit quota with images.
    }

    try {
      await idbSet(storageKey(year), next);
      return true;
    } catch {
      return localOk;
    }
  }, [selectedYear]);

  useEffect(() => {
    if (!isHydrated) return;
    if (!didLoadRef.current) {
      didLoadRef.current = true;
      return;
    }

    const runId = ++saveRunRef.current;
    const frame = window.requestAnimationFrame(() => setSaveStatus("unsaved"));
    const timeout = window.setTimeout(() => {
      setSaveStatus("saving");
      void (async () => {
        const ok = await persistSilent(board, selectedYear);
        if (runId !== saveRunRef.current) return;
        setSaveStatus(ok ? "saved" : "error");
      })();
    }, 260);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [board, selectedYear, isHydrated, persistSilent]);

  useEffect(() => {
    let active = true;
    const frame = window.requestAnimationFrame(() => {
      void (async () => {
        try {
          const stored = (await idbGet(storageKey(CURRENT_YEAR))) as BoardData | undefined;
          if (stored && active) {
            setBoard(normalizeBoard(stored, CURRENT_YEAR));
            setIsHydrated(true);
            return;
          }
        } catch {
          // fall back to localStorage
        }

        const fallback = loadBoard(CURRENT_YEAR);
        if (active) {
          setBoard(fallback);
          setIsHydrated(true);
        }
      })();
    });

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  useEffect(() => {
    const computeOverflowingNotes = () => {
      const nextIds = board.items
        .filter((item) => item.kind !== "image" && item.kind !== "stamp" && item.kind !== "text")
        .filter((item) => {
          const node = noteBodyRefs.current[item.id];
          if (!node) return false;
          const bodyClipped = node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1;
          const ownerAndSpacingHeight = 34; // owner line + spacing near the bottom of note cards
          const requiredNoteHeight = node.scrollHeight + ownerAndSpacingHeight;
          const cardTooShort = requiredNoteHeight > item.height - 12;
          return bodyClipped || cardTooShort;
        })
        .map((item) => item.id);
      setOverflowingNoteIds(nextIds);
    };

    const frame = window.requestAnimationFrame(computeOverflowingNotes);
    window.addEventListener("resize", computeOverflowingNotes);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", computeOverflowingNotes);
    };
  }, [board.items, editingTextId]);

  const cloneBoard = (value: BoardData): BoardData => JSON.parse(JSON.stringify(value)) as BoardData;

  const saveBoard = (next: BoardData, _year = selectedYear, trackHistory = true) => {
    if (trackHistory) {
      historyRef.current.push(cloneBoard(boardRef.current));
      if (historyRef.current.length > 100) historyRef.current.shift();
      futureRef.current = [];
    }

    setBoard(next);
    void _year;
  };

  const forceSaveNow = useCallback(async () => {
    if (!isHydrated) return;
    const runId = ++saveRunRef.current;
    setSaveStatus("saving");
    const drafts = liveTextDraftsRef.current;
    const draftIds = Object.keys(drafts);
    const snapshot =
      draftIds.length === 0
        ? boardRef.current
        : {
            ...boardRef.current,
            items: boardRef.current.items.map((item) => {
              const nextText = drafts[item.id];
              return typeof nextText === "string" ? { ...item, text: nextText } : item;
            }),
          };
    const ok = await persistSilent(snapshot, selectedYear);
    if (runId !== saveRunRef.current) return;
    setSaveStatus(ok ? "saved" : "error");
  }, [isHydrated, persistSilent, selectedYear]);

  const buildBoardWithLiveTextDrafts = useCallback((base: BoardData) => {
    const drafts = liveTextDraftsRef.current;
    const draftIds = Object.keys(drafts);
    if (draftIds.length === 0) return base;
    let changed = false;
    const items = base.items.map((item) => {
      const nextText = drafts[item.id];
      if (typeof nextText !== "string" || nextText === item.text) return item;
      changed = true;
      return { ...item, text: nextText };
    });
    return changed ? { ...base, items } : base;
  }, []);

  const flushLiveTextDrafts = useCallback(async () => {
    if (!isHydrated) return;
    await forceSaveNow();
  }, [forceSaveNow, isHydrated]);

  useEffect(() => {
    const flushOnHidden = () => {
      if (document.visibilityState === "hidden") {
        void flushLiveTextDrafts();
      }
    };

    const flushOnPageHide = () => {
      void flushLiveTextDrafts();
    };

    document.addEventListener("visibilitychange", flushOnHidden);
    window.addEventListener("pagehide", flushOnPageHide);
    return () => {
      document.removeEventListener("visibilitychange", flushOnHidden);
      window.removeEventListener("pagehide", flushOnPageHide);
    };
  }, [flushLiveTextDrafts]);

  useEffect(() => {
    return () => {
      if (liveTextSaveTimerRef.current) {
        window.clearTimeout(liveTextSaveTimerRef.current);
        liveTextSaveTimerRef.current = null;
      }
    };
  }, []);

  const addCard = (kind: BoardItemKind) => {
    if (kind === "northstar" && board.items.some((item) => item.kind === "northstar")) return;
    const index = board.items.length;
    const isNorthStar = kind === "northstar";
    const northStarWidth = 230;
    const northStarHeight = 139;
    const areaWidth = boardAreaRef.current?.clientWidth ?? CANVAS_WIDTH;
    const next: BoardData = {
      ...board,
      items: [
        ...board.items,
        {
          id: nextId(kind),
          kind,
          text:
            kind === "goal"
              ? "new goal"
              : kind === "win"
                ? "new win"
                : kind === "northstar"
                  ? "your north star"
                  : "new focus",
          x: isNorthStar
            ? Math.max(8, Math.round((areaWidth - northStarWidth) / 2))
            : 58 + ((index * 30) % 620),
          y: isNorthStar ? 20 : 66 + ((index * 36) % 380),
          width: isNorthStar ? northStarWidth : 180,
          height: isNorthStar ? northStarHeight : 180,
          tilt: (index % 6) - 3,
        },
      ],
    };
    saveBoard(next);
    setSelectedIds([next.items[next.items.length - 1].id]);
  };

  const addTextAt = (x: number, y: number) => {
    const nextItem: BoardItem = {
      id: nextId("text"),
      kind: "text",
      text: "new text",
      textColor: "#0f172a",
      textSize: 26,
      textBold: false,
      textItalic: false,
      x: Math.max(0, Math.min(x, CANVAS_WIDTH - 213)),
      y: Math.max(0, Math.min(y, CANVAS_HEIGHT - 66)),
      width: 213,
      height: 66,
      tilt: 0,
    };
    const next = { ...boardRef.current, items: [...boardRef.current.items, nextItem] };
    saveBoard(next);
    setSelectedIds([nextItem.id]);
    setEditingTextId(nextItem.id);
    textDraftIdRef.current = nextItem.id;
  };

  const addStamp = (value: string) => {
    const index = boardRef.current.items.length;
    const size = 72;
    const nextItem: BoardItem = {
      id: nextId("stamp"),
      kind: "stamp",
      text: value,
      x: 120 + ((index * 28) % 720),
      y: 120 + ((index * 24) % 420),
      width: size,
      height: size,
      tilt: 0,
    };
    const next = { ...boardRef.current, items: [...boardRef.current.items, nextItem] };
    saveBoard(next);
    setSelectedIds([nextItem.id]);
    setIsStampPickerOpen(false);
  };

  const addStampAt = (value: string, x: number, y: number) => {
    const size = 72;
    const nextItem: BoardItem = {
      id: nextId("stamp"),
      kind: "stamp",
      text: value,
      x: Math.max(0, Math.min(x - size / 2, CANVAS_WIDTH - size)),
      y: Math.max(0, Math.min(y - size / 2, CANVAS_HEIGHT - size)),
      width: size,
      height: size,
      tilt: 0,
    };
    const next = { ...boardRef.current, items: [...boardRef.current.items, nextItem] };
    saveBoard(next);
    setSelectedIds([nextItem.id]);
  };

  const addImageCard = (src: string, naturalWidth: number, naturalHeight: number, x: number, y: number) => {
    const maxWidth = 295;
    const maxHeight = 246;
    const baseWidth = Math.max(1, naturalWidth);
    const baseHeight = Math.max(1, naturalHeight);
    const scale = Math.min(maxWidth / baseWidth, maxHeight / baseHeight, 1);
    const width = Math.max(115, Math.round(baseWidth * scale));
    const height = Math.max(82, Math.round(baseHeight * scale));

    const nextItem: BoardItem = {
      id: nextId("image"),
      kind: "image",
      text: "",
      imageSrc: src,
      imageRatio: baseWidth / baseHeight,
      x: Math.max(0, Math.min(x, CANVAS_WIDTH - width)),
      y: Math.max(0, Math.min(y, CANVAS_HEIGHT - height)),
      width,
      height,
      tilt: 0,
    };

    const next = { ...boardRef.current, items: [...boardRef.current.items, nextItem] };
    saveBoard(next);
    setSelectedIds([nextItem.id]);
  };

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("file read failed"));
      reader.readAsDataURL(file);
    });

  const dataUrlToImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image load failed"));
      img.src = src;
    });

  const compressForStorage = async (file: File) => {
    const src = await fileToDataUrl(file);
    const img = await dataUrlToImage(src);

    const maxSide = 1280;
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { src, width: img.naturalWidth, height: img.naturalHeight };
    ctx.drawImage(img, 0, 0, width, height);

    let quality = 0.88;
    let out = canvas.toDataURL("image/webp", quality);
    const targetMax = 1_400_000;
    while (out.length > targetMax && quality > 0.5) {
      quality -= 0.08;
      out = canvas.toDataURL("image/webp", quality);
    }

    return { src: out, width, height };
  };

  const handleBoardDragOver = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragOverBoard(true);
    event.dataTransfer.dropEffect = "copy";
  };

  const getDroppedImageFile = (event: React.DragEvent<HTMLElement>) => {
    const dt = event.dataTransfer;
    if (dt.files && dt.files.length > 0) {
      const file = Array.from(dt.files).find((candidate) => candidate.type.startsWith("image/"));
      if (file) return file;
    }

    if (dt.items && dt.items.length > 0) {
      for (const item of Array.from(dt.items)) {
        if (item.kind !== "file") continue;
        const file = item.getAsFile();
        if (file && file.type.startsWith("image/")) return file;
      }
    }

    return null;
  };

  const getDroppedStamp = (event: React.DragEvent<HTMLElement>) => {
    const dt = event.dataTransfer;
    const raw = dt.getData("application/x-vision-stamp") || dt.getData("text/plain");
    const value = raw.trim();
    return STAMP_SET.includes(value) ? value : null;
  };

  const startStampDrag = (event: React.DragEvent<HTMLButtonElement>, value: string) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-vision-stamp", value);
    event.dataTransfer.setData("text/plain", value);
    setIsStampPickerOpen(false);
  };

  const handleBoardDrop = (event: React.DragEvent<HTMLElement>) => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    setIsDragOverBoard(false);
    if (!boardAreaRef.current) return;

    const areaRect = boardAreaRef.current.getBoundingClientRect();
    const dropX = Math.max(0, event.clientX - areaRect.left);
    const dropY = Math.max(0, event.clientY - areaRect.top);

    const stamp = getDroppedStamp(event);
    if (stamp) {
      addStampAt(stamp, dropX, dropY);
      return;
    }

    const file = getDroppedImageFile(event);
    if (!file) return;
    void compressForStorage(file)
      .then(({ src, width, height }) => {
        addImageCard(src, width, height, dropX, dropY);
      })
      .catch(() => {
        // Ignore invalid files quietly for now.
      });
  };

  const registerLiveTextDraft = (id: string, text: string) => {
    liveTextDraftsRef.current[id] = text;
    if (liveTextSaveTimerRef.current) window.clearTimeout(liveTextSaveTimerRef.current);
    liveTextSaveTimerRef.current = window.setTimeout(() => {
      liveTextSaveTimerRef.current = null;
      const withDrafts = buildBoardWithLiveTextDrafts(boardRef.current);
      if (withDrafts === boardRef.current) return;
      const runId = ++saveRunRef.current;
      setSaveStatus("saving");
      void persistSilent(withDrafts, selectedYear).then((ok) => {
        if (runId !== saveRunRef.current) return;
        setSaveStatus(ok ? "saved" : "error");
      });
    }, 320);
  };

  const updateCardText = (id: string, text: string) => {
    delete liveTextDraftsRef.current[id];
    const next = {
      ...boardRef.current,
      items: boardRef.current.items.map((item) => (item.id === id ? { ...item, text } : item)),
    };
    saveBoard(next);
  };

  const updateTextStyle = (
    id: string,
    patch: Partial<Pick<BoardItem, "textColor" | "textSize" | "textBold" | "textItalic">>,
  ) => {
    const next = {
      ...boardRef.current,
      items: boardRef.current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    };
    saveBoard(next);
  };

  const autoFitCardHeight = (id: string, contentEl: HTMLDivElement) => {
    const overflow = contentEl.scrollHeight - contentEl.clientHeight;
    if (overflow <= 2) return;
    const currentItem = boardRef.current.items.find((item) => item.id === id);
    if (!currentItem) return;
    const neededHeight = Math.min(520, Math.max(131, currentItem.height + overflow + 8));
    setBoard((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id && neededHeight > item.height
          ? {
              ...item,
              height: neededHeight,
            }
          : item,
      ),
    }));
  };

  const startPointerDrag = (id: string, event: React.PointerEvent<HTMLElement>) => {
    if (!boardAreaRef.current || event.button !== 0 || resizeRef.current) return;
    const selectedSet = new Set(selectedIdsRef.current);
    const ids = selectedSet.size > 1 && selectedSet.has(id) ? selectedIdsRef.current : [id];
    const starts: Record<string, { x: number; y: number; width: number; height: number }> = {};

    for (const item of boardRef.current.items) {
      if (!ids.includes(item.id)) continue;
      starts[item.id] = { x: item.x, y: item.y, width: item.width, height: item.height };
    }

    dragSessionRef.current = {
      ids,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      starts,
    };
    historyRef.current.push(cloneBoard(boardRef.current));
    if (historyRef.current.length > 100) historyRef.current.shift();
    futureRef.current = [];
  };

  const startTitleEdit = () => {
    setTitleDraft(boardRef.current.title);
    setIsEditingTitle(true);
  };

  const commitTitle = () => {
    const nextTitle = titleDraft.trim();
    if (nextTitle.length > 0 && nextTitle !== boardRef.current.title) {
      saveBoard({ ...boardRef.current, title: nextTitle }, selectedYear);
    }
    setIsEditingTitle(false);
  };

  const startOwnerEdit = () => {
    setOwnerDraft(boardRef.current.ownerName);
    setIsEditingOwner(true);
  };

  const commitOwner = () => {
    const nextOwner = ownerDraft.trim();
    if (nextOwner.length > 0 && nextOwner !== boardRef.current.ownerName) {
      saveBoard({ ...boardRef.current, ownerName: nextOwner }, selectedYear);
    }
    setIsEditingOwner(false);
  };

  const reorderLayers = (mode: "front" | "back", targetId?: string) => {
    const current = boardRef.current;
    const currentSelected = selectedIdsRef.current;
    const activeIds = targetId
      ? currentSelected.includes(targetId)
        ? currentSelected
        : [targetId]
      : currentSelected;
    if (activeIds.length === 0) return;

    const selectedSet = new Set(activeIds);
    const picked = current.items.filter((item) => selectedSet.has(item.id));
    const rest = current.items.filter((item) => !selectedSet.has(item.id));
    const items = mode === "front" ? [...rest, ...picked] : [...picked, ...rest];
    saveBoard({ ...current, items }, selectedYear);
  };

  const intersect = (
    a: { left: number; right: number; top: number; bottom: number },
    b: { left: number; right: number; top: number; bottom: number },
  ) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

  const startMarquee = (event: React.PointerEvent<HTMLElement>) => {
    if (!boardAreaRef.current || event.button !== 0) return;
    const areaRect = boardAreaRef.current.getBoundingClientRect();
    const x = Math.min(areaRect.width, Math.max(0, event.clientX - areaRect.left));
    const y = Math.min(areaRect.height, Math.max(0, event.clientY - areaRect.top));

    if (activeTool === "text") {
      addTextAt(x, y);
      return;
    }

    setEditingTextId(null);
    const additive = event.shiftKey || event.ctrlKey || event.metaKey;
    const baseSelected = additive ? selectedIdsRef.current : [];

    marqueeRef.current = { startX: x, startY: y, additive, baseSelected };
    setMarquee({ startX: x, startY: y, currentX: x, currentY: y });
    if (!additive) setSelectedIds([]);
  };

  const startResize = (event: React.PointerEvent<HTMLButtonElement>, item: BoardItem) => {
    event.preventDefault();
    event.stopPropagation();
    historyRef.current.push(cloneBoard(boardRef.current));
    if (historyRef.current.length > 100) historyRef.current.shift();
    futureRef.current = [];
    setSelectedIds([item.id]);
    resizeRef.current = {
      id: item.id,
      startX: event.clientX,
      startY: event.clientY,
      startW: item.width,
      startH: item.height,
    };
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const active = resizeRef.current;
      if (!active) return;

      const dx = event.clientX - active.startX;
      const dy = event.clientY - active.startY;

      setBoard((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === active.id
            ? {
                ...item,
                ...(item.kind === "image"
                  ? (() => {
                      if (event.ctrlKey) {
                        const freeWidth = Math.min(900, Math.max(120, active.startW + dx));
                        const freeHeight = Math.min(900, Math.max(100, active.startH + dy));
                        return {
                          width: freeWidth,
                          height: freeHeight,
                          imageRatio: freeWidth / freeHeight,
                        };
                      }
                      const ratio = item.imageRatio && item.imageRatio > 0 ? item.imageRatio : active.startW / active.startH;
                      const scaleX = (active.startW + dx) / active.startW;
                      const scaleY = (active.startH + dy) / active.startH;
                      const scale = Math.max(scaleX, scaleY);
                      const nextWidth = Math.min(900, Math.max(120, Math.round(active.startW * scale)));
                      return {
                        width: nextWidth,
                        height: Math.round(nextWidth / ratio),
                        imageRatio: ratio,
                      };
                    })()
                  : item.kind === "text"
                    ? (() => {
                        const minWidth = 80;
                        const minHeight = Math.max(40, Math.round((item.textSize ?? 32) * 1.25 + 14));
                        return {
                          width: Math.min(900, Math.max(minWidth, active.startW + dx)),
                          height: Math.min(420, Math.max(minHeight, active.startH + dy)),
                        };
                      })()
                  : item.kind === "stamp"
                    ? (() => {
                        const minSize = 16;
                        const maxSize = 520;
                        const nextSize = Math.min(
                          maxSize,
                          Math.max(minSize, Math.max(active.startW + dx, active.startH + dy)),
                        );
                        return {
                          width: nextSize,
                          height: nextSize,
                        };
                      })()
                  : (() => {
                      const minWidth = 80;
                      const minHeight = 78;
                      return {
                        width: Math.min(520, Math.max(minWidth, active.startW + dx)),
                        height: Math.min(520, Math.max(minHeight, active.startH + dy)),
                      };
                    })()),
              }
            : item,
        ),
      }));
    };

    const handlePointerUp = () => {
      if (!resizeRef.current) return;
      resizeRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragSessionRef.current;
      if (!drag || !boardAreaRef.current) return;
      document.body.style.userSelect = "none";
      window.getSelection()?.removeAllRanges();

      const areaWidth = boardAreaRef.current.clientWidth;
      const areaHeight = boardAreaRef.current.clientHeight;
      const rawDx = event.clientX - drag.startPointerX;
      const rawDy = event.clientY - drag.startPointerY;

      let minDx = -Infinity;
      let maxDx = Infinity;
      let minDy = -Infinity;
      let maxDy = Infinity;
      for (const id of drag.ids) {
        const start = drag.starts[id];
        if (!start) continue;
        minDx = Math.max(minDx, -start.x);
        maxDx = Math.min(maxDx, areaWidth - start.width - start.x);
        minDy = Math.max(minDy, -start.y);
        maxDy = Math.min(maxDy, areaHeight - start.height - start.y);
      }

      const dx = Math.min(maxDx, Math.max(minDx, rawDx));
      const dy = Math.min(maxDy, Math.max(minDy, rawDy));
      const idsSet = new Set(drag.ids);

      setBoard((prev) => ({
        ...prev,
        items: prev.items.map((item) => {
          if (!idsSet.has(item.id)) return item;
          const start = drag.starts[item.id];
          if (!start) return item;
          return { ...item, x: start.x + dx, y: start.y + dy };
        }),
      }));
    };

    const handlePointerUp = () => {
      if (!dragSessionRef.current) return;
      dragSessionRef.current = null;
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!marqueeRef.current || !boardAreaRef.current) return;
      const areaRect = boardAreaRef.current.getBoundingClientRect();
      const currentX = Math.min(areaRect.width, Math.max(0, event.clientX - areaRect.left));
      const currentY = Math.min(areaRect.height, Math.max(0, event.clientY - areaRect.top));
      const session = marqueeRef.current;

      const selectionRect = {
        left: Math.min(session.startX, currentX),
        right: Math.max(session.startX, currentX),
        top: Math.min(session.startY, currentY),
        bottom: Math.max(session.startY, currentY),
      };

      const hitIds = boardRef.current.items
        .filter((item) =>
          intersect(
            selectionRect,
            { left: item.x, right: item.x + item.width, top: item.y, bottom: item.y + item.height },
          ),
        )
        .map((item) => item.id);

      const nextIds = session.additive
        ? Array.from(new Set([...session.baseSelected, ...hitIds]))
        : hitIds;

      setMarquee({ startX: session.startX, startY: session.startY, currentX, currentY });
      setSelectedIds(nextIds);
    };

    const handlePointerUp = () => {
      if (!marqueeRef.current) return;
      marqueeRef.current = null;
      setMarquee(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  useEffect(() => {
    const isEditingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA";
    };

    const handleUndo = () => {
      const previous = historyRef.current.pop();
      if (!previous) return;
      futureRef.current.unshift(cloneBoard(boardRef.current));
      setBoard(previous);
    };

    const handleRedo = () => {
      const next = futureRef.current.shift();
      if (!next) return;
      historyRef.current.push(cloneBoard(boardRef.current));
      setBoard(next);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (isEditingTarget(event.target)) return;

      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
          return;
        }
        handleUndo();
        return;
      }

      if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        handleRedo();
        return;
      }

      const current = boardRef.current;
      const selectedSet = new Set(selectedIdsRef.current);
      const selectedItems = current.items.filter((item) => selectedSet.has(item.id));
      const step = event.shiftKey ? 16 : 4;

      if (selectedItems.length > 0 && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        const areaWidth = boardAreaRef.current?.clientWidth ?? CANVAS_WIDTH;
        const areaHeight = boardAreaRef.current?.clientHeight ?? CANVAS_HEIGHT;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;

        const next = {
          ...current,
          items: current.items.map((item) => {
            if (!selectedSet.has(item.id)) return item;
            const maxX = Math.max(0, areaWidth - item.width);
            const maxY = Math.max(0, areaHeight - item.height);
            return {
              ...item,
              x: Math.min(maxX, Math.max(0, item.x + dx)),
              y: Math.min(maxY, Math.max(0, item.y + dy)),
            };
          }),
        };
        historyRef.current.push(cloneBoard(boardRef.current));
        if (historyRef.current.length > 100) historyRef.current.shift();
        futureRef.current = [];
        setBoard(next);
        return;
      }

      if (mod && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setSelectedIds(current.items.map((item) => item.id));
        return;
      }

      if (mod && event.key.toLowerCase() === "c") {
        if (selectedItems.length === 0) return;
        event.preventDefault();
        clipboardRef.current = selectedItems.map((item) => ({ ...item }));
        return;
      }

      if (mod && event.key.toLowerCase() === "x") {
        if (selectedItems.length === 0) return;
        event.preventDefault();
        clipboardRef.current = selectedItems.map((item) => ({ ...item }));
        const next = { ...current, items: current.items.filter((item) => !selectedSet.has(item.id)) };
        setSelectedIds([]);
        historyRef.current.push(cloneBoard(boardRef.current));
        if (historyRef.current.length > 100) historyRef.current.shift();
        futureRef.current = [];
        setBoard(next);
        return;
      }

      if (mod && event.key.toLowerCase() === "v") {
        if (clipboardRef.current.length === 0) return;
        event.preventDefault();
        const pasted = clipboardRef.current.map((item) => ({
          ...item,
          id: nextId(item.kind),
          x: Math.max(0, item.x + 24),
          y: Math.max(0, item.y + 24),
        }));
        const next = { ...current, items: [...current.items, ...pasted] };
        setSelectedIds(pasted.map((item) => item.id));
        historyRef.current.push(cloneBoard(boardRef.current));
        if (historyRef.current.length > 100) historyRef.current.shift();
        futureRef.current = [];
        setBoard(next);
        return;
      }

      if (mod && event.key.toLowerCase() === "d") {
        if (selectedItems.length === 0) return;
        event.preventDefault();
        const duplicates = selectedItems.map((item) => ({
          ...item,
          id: nextId(item.kind),
          x: item.x + 24,
          y: item.y + 24,
        }));
        const next = { ...current, items: [...current.items, ...duplicates] };
        setSelectedIds(duplicates.map((item) => item.id));
        historyRef.current.push(cloneBoard(boardRef.current));
        if (historyRef.current.length > 100) historyRef.current.shift();
        futureRef.current = [];
        setBoard(next);
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedItems.length === 0) return;
        event.preventDefault();
        const next = { ...current, items: current.items.filter((item) => !selectedSet.has(item.id)) };
        setSelectedIds([]);
        historyRef.current.push(cloneBoard(boardRef.current));
        if (historyRef.current.length > 100) historyRef.current.shift();
        futureRef.current = [];
        setBoard(next);
        return;
      }

      if (event.key === "Escape") {
        setSelectedIds([]);
      }

      if (mod && event.key === "]") {
        event.preventDefault();
        const current = boardRef.current;
        const activeIds = selectedIdsRef.current;
        if (activeIds.length === 0) return;
        const selectedSet = new Set(activeIds);
        const picked = current.items.filter((item) => selectedSet.has(item.id));
        const rest = current.items.filter((item) => !selectedSet.has(item.id));
        historyRef.current.push(cloneBoard(boardRef.current));
        if (historyRef.current.length > 100) historyRef.current.shift();
        futureRef.current = [];
        const next = { ...current, items: [...rest, ...picked] };
        setBoard(next);
        return;
      }

      if (mod && event.key === "[") {
        event.preventDefault();
        const current = boardRef.current;
        const activeIds = selectedIdsRef.current;
        if (activeIds.length === 0) return;
        const selectedSet = new Set(activeIds);
        const picked = current.items.filter((item) => selectedSet.has(item.id));
        const rest = current.items.filter((item) => !selectedSet.has(item.id));
        historyRef.current.push(cloneBoard(boardRef.current));
        if (historyRef.current.length > 100) historyRef.current.shift();
        futureRef.current = [];
        const next = { ...current, items: [...picked, ...rest] };
        setBoard(next);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isEditingTitle) return;
    const timeout = window.setTimeout(() => titleInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timeout);
  }, [isEditingTitle]);

  useEffect(() => {
    if (!isEditingOwner) return;
    const timeout = window.setTimeout(() => ownerInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timeout);
  }, [isEditingOwner]);

  useEffect(() => {
    if (!textDraftIdRef.current) return;
    const id = textDraftIdRef.current;
    const timeout = window.setTimeout(() => {
      const node = document.querySelector(`[data-text-id="${id}"]`) as HTMLDivElement | null;
      if (!node) return;
      node.focus();
      const range = document.createRange();
      range.selectNodeContents(node);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      textDraftIdRef.current = null;
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [board.items, editingTextId]);

  if (!isHydrated) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-100 font-[family-name:var(--font-space-grotesk)] text-slate-800">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,_rgba(15,23,42,0.16)_1px,transparent_1px)] bg-[size:16px_16px]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.8)_0%,rgba(241,245,249,0.92)_100%)]" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 font-[family-name:var(--font-space-grotesk)] text-slate-800">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,_rgba(15,23,42,0.16)_1px,transparent_1px)] bg-[size:16px_16px]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.8)_0%,rgba(241,245,249,0.92)_100%)]" />

      <main className="relative z-10 mx-auto h-screen max-w-[1600px] p-3 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <Card className="w-fit max-w-[calc(100%-1rem)] border border-slate-200/80 bg-white/95 shadow-md">
            <CardBody className="flex flex-row items-center justify-between gap-3 p-3">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="grid h-7 w-7 place-items-center rounded-md border border-slate-300 bg-slate-50 text-xs font-semibold">
                  yr
                </div>
                {isEditingTitle ? (
                  <Input
                    ref={titleInputRef}
                    size="sm"
                    value={titleDraft}
                    onValueChange={setTitleDraft}
                    onBlur={commitTitle}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitTitle();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setIsEditingTitle(false);
                      }
                    }}
                    className="max-w-[260px]"
                  />
                ) : (
                  <button
                    type="button"
                    onDoubleClick={startTitleEdit}
                    className="truncate text-sm font-semibold text-left sm:text-lg"
                    aria-label="edit board title"
                  >
                    {board.title}
                  </button>
                )}
                <Tooltip
                  content={
                    saveStatus === "saved"
                      ? "saved"
                      : saveStatus === "saving"
                        ? "saving..."
                        : saveStatus === "unsaved"
                          ? "not saved - click to save"
                          : "save failed - click to retry"
                  }
                  delay={120}
                >
                  <button
                    type="button"
                    onClick={() => {
                      void forceSaveNow();
                    }}
                    className="grid h-6 w-6 place-items-center text-slate-500"
                    aria-label="save board now"
                  >
                    {saveStatus === "saved" ? (
                      <FiCloud className="text-sm text-emerald-600" />
                    ) : saveStatus === "saving" ? (
                      <FiLoader className="text-sm animate-spin text-sky-600" />
                    ) : saveStatus === "unsaved" ? (
                      <FiCloudOff className="text-sm text-amber-500" />
                    ) : (
                      <FiCloudOff className="text-sm text-rose-600" />
                    )}
                  </button>
                </Tooltip>
              </div>
            </CardBody>
          </Card>
          <Card className="w-fit max-w-[42%] border border-slate-200/80 bg-white/95 shadow-md">
            <CardBody className="p-3">
              {isEditingOwner ? (
                <Input
                  ref={ownerInputRef}
                  size="sm"
                  value={ownerDraft}
                  onValueChange={setOwnerDraft}
                  onBlur={commitOwner}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitOwner();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setIsEditingOwner(false);
                    }
                  }}
                  className="max-w-[260px]"
                />
              ) : (
                <Tooltip content="double-click to change name" delay={120}>
                  <button
                    type="button"
                    onDoubleClick={startOwnerEdit}
                    className="truncate text-sm font-medium text-slate-700"
                    aria-label="edit owner name"
                  >
                    {board.ownerName}
                  </button>
                </Tooltip>
              )}
            </CardBody>
          </Card>
        </div>

        <section
          ref={boardAreaRef}
          onPointerDown={startMarquee}
          onDragEnterCapture={(event) => {
            event.preventDefault();
            setIsDragOverBoard(true);
          }}
          onDragOver={handleBoardDragOver}
          onDragLeaveCapture={() => setIsDragOverBoard(false)}
          onDrop={handleBoardDrop}
          className={`relative mt-4 h-[calc(100vh-175px)] w-full overflow-hidden rounded-2xl border bg-white/25 backdrop-blur-[2px] ${
            isDragOverBoard ? "border-sky-400/80 shadow-[0_0_0_2px_rgba(56,189,248,0.25)]" : "border-slate-200/70"
          } ${activeTool === "text" ? "cursor-text" : ""}`}
        >
          {focusedTextItem && (
            <div
              onPointerDown={(event) => event.stopPropagation()}
              className="absolute z-40 flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900/95 px-2 py-1 text-white shadow-lg"
              style={{ left: Math.max(12, focusedTextItem.x), top: Math.max(8, focusedTextItem.y - 44) }}
            >
              <div className="flex items-center gap-1 pr-1">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => updateTextStyle(focusedTextItem.id, { textColor: color })}
                    className={`h-5 w-5 rounded-full border ${
                      focusedTextItem.textColor === color ? "border-white" : "border-slate-300/40"
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`set text color ${color}`}
                  />
                ))}
              </div>
              <div className="mx-1 h-5 w-px bg-white/25" />
              {TEXT_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => updateTextStyle(focusedTextItem.id, { textSize: size })}
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    focusedTextItem.textSize === size ? "bg-white/20" : "hover:bg-white/10"
                  }`}
                >
                  {size}
                </button>
              ))}
              <div className="mx-1 h-5 w-px bg-white/25" />
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => updateTextStyle(focusedTextItem.id, { textBold: !focusedTextItem.textBold })}
                className={`rounded px-2 py-0.5 text-sm font-bold ${
                  focusedTextItem.textBold ? "bg-white/20" : "hover:bg-white/10"
                }`}
                aria-label="toggle bold"
              >
                B
              </button>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => updateTextStyle(focusedTextItem.id, { textItalic: !focusedTextItem.textItalic })}
                className={`rounded px-2 py-0.5 text-sm italic ${
                  focusedTextItem.textItalic ? "bg-white/20" : "hover:bg-white/10"
                }`}
                aria-label="toggle italic"
              >
                I
              </button>
            </div>
          )}
          {board.items.length === 0 ? (
            <div className="grid h-full place-items-center text-slate-500">
              <p>start your board from the dock below.</p>
            </div>
          ) : (
            board.items.map((item, idx) => (
              <motion.article
                key={item.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.24 }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  const multi = event.shiftKey || event.ctrlKey || event.metaKey;
                  if (multi) {
                    setSelectedIds((prev) =>
                      prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id],
                    );
                    return;
                  }
                  // If multi-select isn't pressed, dragging should target only the clicked item.
                  setSelectedIds([item.id]);
                  startPointerDrag(item.id, event);
                }}
                className={`absolute flex cursor-grab flex-col rounded-sm active:cursor-grabbing ${
                  item.kind === "image" || item.kind === "stamp" || item.kind === "text" ? "p-0" : "p-3"
                } ${
                  item.kind === "image" || item.kind === "stamp" || item.kind === "text" ? "" : "border shadow-sm"
                } ${noteStyle(item.kind)} ${
                  item.kind !== "image" && selectedIds.includes(item.id) ? "ring-2 ring-slate-500/50" : ""
                } ${
                  overflowingNoteIds.includes(item.id) ? "border-2 border-red-500" : ""
                } select-none`}
                style={{ left: item.x, top: item.y, width: item.width, height: item.height, zIndex: idx + 1 }}
              >
                {item.kind !== "image" && item.kind !== "stamp" && item.kind !== "text" && (
                  <Chip
                    size="sm"
                    variant="flat"
                    radius="sm"
                    className={`absolute -top-3 left-3 px-2 text-[10px] font-medium uppercase tracking-wide ${
                      item.kind === "northstar"
                        ? "border border-amber-400 bg-amber-200 text-amber-900"
                        : "border border-slate-300 bg-slate-100 text-slate-600"
                    }`}
                  >
                    {kindLabel(item.kind)}
                  </Chip>
                )}
                {item.kind === "image" && item.imageSrc && !failedImageIds.includes(item.id) ? (
                  <div className="relative flex-1 overflow-hidden rounded-sm bg-transparent">
                    <Image
                      src={item.imageSrc}
                      alt="vision board upload"
                      fill
                      unoptimized
                      sizes="360px"
                      onError={() =>
                        setFailedImageIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]))
                      }
                      draggable={false}
                      className="pointer-events-none object-fill select-none"
                    />
                  </div>
                ) : item.kind === "image" ? (
                  <div className="grid h-full w-full place-items-center rounded-sm bg-slate-200 text-xs text-slate-500">
                    image missing
                  </div>
                ) : item.kind === "stamp" ? (
                  <div
                    className="pointer-events-none grid h-full w-full place-items-center bg-transparent text-4xl leading-none"
                    style={{ fontSize: `${Math.max(8, Math.round(Math.min(item.width, item.height) * 0.52))}px` }}
                  >
                    {item.text || "⭐"}
                  </div>
                ) : item.kind === "text" ? (
                  <div
                    data-text-id={item.id}
                    className={`h-full w-full whitespace-pre-wrap bg-transparent px-2 py-1 outline-none ${
                      editingTextId === item.id ? "select-text" : "select-none"
                    }`}
                    style={{
                      color: item.textColor ?? "#0f172a",
                      fontSize: `${item.textSize ?? 32}px`,
                      fontWeight: item.textBold ? 700 : 500,
                      fontStyle: item.textItalic ? "italic" : "normal",
                      lineHeight: 1.2,
                    }}
                    contentEditable={editingTextId === item.id}
                    suppressContentEditableWarning
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      setEditingTextId(item.id);
                      const el = event.currentTarget;
                      window.requestAnimationFrame(() => el.focus());
                    }}
                    onPointerDown={(event) => {
                      if (editingTextId === item.id) {
                        event.stopPropagation();
                      }
                    }}
                    onFocus={() => {
                      setEditingTextId(item.id);
                      setSelectedIds([item.id]);
                    }}
                    onInput={(event) => {
                      registerLiveTextDraft(item.id, readEditableText(event.currentTarget));
                    }}
                    onBlur={(event) => {
                      updateCardText(item.id, readEditableText(event.currentTarget));
                      if (editingTextId === item.id) setEditingTextId(null);
                    }}
                  >
                    {item.text}
                  </div>
                ) : (
                  <>
                    <div
                      ref={(node) => {
                        noteBodyRefs.current[item.id] = node;
                      }}
                      data-note-body-id={item.id}
                      className={`min-h-0 flex-1 overflow-hidden whitespace-pre-wrap rounded-sm bg-transparent p-2 text-sm leading-snug text-slate-700 outline-none ring-0 ${
                        editingTextId === item.id ? "select-text" : "select-none"
                      }`}
                      contentEditable={editingTextId === item.id}
                      suppressContentEditableWarning
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        setEditingTextId(item.id);
                        const el = event.currentTarget;
                        window.requestAnimationFrame(() => {
                          el.focus();
                        });
                      }}
                      onPointerDown={(event) => {
                        if (editingTextId === item.id) {
                          event.stopPropagation();
                        }
                      }}
                      onInput={(event) => {
                        autoFitCardHeight(item.id, event.currentTarget);
                        registerLiveTextDraft(item.id, readEditableText(event.currentTarget));
                      }}
                      onBlur={(event) => {
                        updateCardText(item.id, readEditableText(event.currentTarget));
                        if (editingTextId === item.id) setEditingTextId(null);
                      }}
                    >
                      {item.text}
                    </div>
                    <p className="mt-2 select-none text-xs text-slate-500">{board.ownerName}</p>
                  </>
                )}
                {selectedIds.includes(item.id) && (
                  <button
                    type="button"
                    aria-label="resize card"
                    className="absolute -bottom-2 -right-2 h-4 w-4 cursor-se-resize rounded-[4px] border-2 border-sky-500 bg-white shadow-sm"
                    onPointerDown={(event) => startResize(event, item)}
                  />
                )}
              </motion.article>
            ))
          )}
          {marquee && (
            <div
              className="pointer-events-none absolute border border-sky-500/70 bg-sky-300/20"
              style={{
                left: Math.min(marquee.startX, marquee.currentX),
                top: Math.min(marquee.startY, marquee.currentY),
                width: Math.abs(marquee.currentX - marquee.startX),
                height: Math.abs(marquee.currentY - marquee.startY),
              }}
            />
          )}
        </section>

        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
          <Card className="pointer-events-auto relative overflow-visible border border-slate-200/85 bg-white/95 shadow-lg">
            <CardBody className="flex flex-row items-center gap-2 overflow-visible p-2">
              <Tooltip content="add goal" delay={120}>
                <Button
                  size="sm"
                  variant="flat"
                  isIconOnly
                  onPress={() => {
                    setActiveTool("select");
                    addCard("goal");
                  }}
                  aria-label="add goal"
                >
                  <span className="sr-only">add goal</span>
                  <FiTarget className="text-sm" />
                </Button>
              </Tooltip>
              <Tooltip content="add win" delay={120}>
                <Button
                  size="sm"
                  variant="flat"
                  isIconOnly
                  onPress={() => {
                    setActiveTool("select");
                    addCard("win");
                  }}
                  aria-label="add win"
                >
                  <span className="sr-only">add win</span>
                  <FiAward className="text-sm" />
                </Button>
              </Tooltip>
              <Tooltip content="add focus" delay={120}>
                <Button
                  size="sm"
                  variant="flat"
                  isIconOnly
                  onPress={() => {
                    setActiveTool("select");
                    addCard("focus");
                  }}
                  aria-label="add focus"
                >
                  <span className="sr-only">add focus</span>
                  <FiEye className="text-sm" />
                </Button>
              </Tooltip>
              <Tooltip content="add north star" delay={120}>
                <Button
                  size="sm"
                  variant="flat"
                  isIconOnly
                  onPress={() => {
                    setActiveTool("select");
                    addCard("northstar");
                  }}
                  isDisabled={stats.hasNorthStar}
                  aria-label="add north star"
                >
                  <span className="sr-only">add north star</span>
                  <FiStar className="text-sm" />
                </Button>
              </Tooltip>
              <Tooltip content="text tool" delay={120}>
                <Button
                  size="sm"
                  variant={activeTool === "text" ? "solid" : "flat"}
                  color={activeTool === "text" ? "secondary" : "default"}
                  isIconOnly
                  onPress={() => {
                    setIsStampPickerOpen(false);
                    setActiveTool((prev) => (prev === "text" ? "select" : "text"));
                  }}
                  aria-label="text tool"
                >
                  <FiType className="text-sm" />
                </Button>
              </Tooltip>
              <Tooltip content="add stamp" delay={120}>
                <Button
                  size="sm"
                  variant={isStampPickerOpen ? "solid" : "flat"}
                  color={isStampPickerOpen ? "secondary" : "default"}
                  isIconOnly
                  onPress={() => {
                    setActiveTool("select");
                    setIsStampPickerOpen((prev) => !prev);
                  }}
                  aria-label="open stamp picker"
                >
                  <FiSmile className="text-sm" />
                </Button>
              </Tooltip>
              <div className="mx-1 h-6 w-px bg-slate-200" />
              <Tooltip content="send to back" delay={120}>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => reorderLayers("back")}
                  isDisabled={selectedIds.length === 0}
                  isIconOnly
                  aria-label="send selected backward"
                >
                  <FiChevronsDown className="text-sm" />
                </Button>
              </Tooltip>
              <Tooltip content="bring to front" delay={120}>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => reorderLayers("front")}
                  isDisabled={selectedIds.length === 0}
                  isIconOnly
                  aria-label="bring selected forward"
                >
                  <FiChevronsUp className="text-sm" />
                </Button>
              </Tooltip>
              <Chip size="sm" variant="flat">
                {selectedIds.length} selected
              </Chip>
              <div className="mx-1 h-6 w-px bg-slate-200" />
              <Chip size="sm" variant="flat" color="primary">
                {stats.goals} goals
              </Chip>
              <Chip size="sm" variant="flat" color="success">
                {stats.wins} wins
              </Chip>
            </CardBody>
            {isStampPickerOpen && (
              <div className="absolute bottom-[calc(100%+10px)] left-1/2 z-30 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl backdrop-blur">
                <p className="mb-2 px-1 text-xs text-slate-500">drag an emoji to drop it on the board</p>
                <div className="grid grid-cols-6 gap-2">
                  {STAMP_SET.map((stamp) => (
                    <button
                      key={stamp}
                      type="button"
                      draggable
                      onDragStart={(event) => startStampDrag(event, stamp)}
                      onClick={() => addStamp(stamp)}
                      className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-xl transition hover:bg-slate-100"
                      aria-label={`add stamp ${stamp}`}
                    >
                      {stamp}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
