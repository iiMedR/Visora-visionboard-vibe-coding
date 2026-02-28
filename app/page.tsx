"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, CardBody, Chip, Input, Tooltip } from "@heroui/react";
import { motion, PanInfo } from "framer-motion";
import { FiAward, FiChevronsDown, FiChevronsUp, FiEye, FiTarget } from "react-icons/fi";

type BoardItemKind = "goal" | "win" | "focus";

type BoardItem = {
  id: string;
  kind: BoardItemKind;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tilt: number;
};

type BoardData = {
  title: string;
  isPublic: boolean;
  credits: number;
  items: BoardItem[];
};

const CURRENT_YEAR = new Date().getFullYear();
const CANVAS_WIDTH = 2800;
const CANVAS_HEIGHT = 1800;
let idCounter = 1;

function storageKey(year: number) {
  return `vision-board-${year}`;
}

function defaultBoard(year: number): BoardData {
  return {
    title: `${year} annual vision board`,
    isPublic: false,
    credits: 50,
    items: [
      {
        id: `${year}-focus`,
        kind: "focus",
        text: "main focus: build, ship, and grow",
        x: 90,
        y: 110,
        width: 220,
        height: 220,
        tilt: -2,
      },
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
            width: typeof item.width === "number" ? item.width : 220,
            height: typeof item.height === "number" ? item.height : 220,
          }))
        : defaultBoard(year).items,
    };
  } catch {
    return defaultBoard(year);
  }
}

function noteStyle() {
  return "bg-sky-100 border-sky-200";
}

function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function kindLabel(kind: BoardItemKind) {
  if (kind === "goal") return "goal";
  if (kind === "win") return "win";
  return "focus";
}

export default function Home() {
  const selectedYear = CURRENT_YEAR;
  const [board, setBoard] = useState<BoardData>(() => defaultBoard(CURRENT_YEAR));
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [groupDrag, setGroupDrag] = useState<{
    draggedId: string;
    offsetX: number;
    offsetY: number;
    areaW: number;
    areaH: number;
    starts: Record<string, { x: number; y: number; width: number; height: number }>;
  } | null>(null);
  const [marquee, setMarquee] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const boardAreaRef = useRef<HTMLElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
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

  const ownerName = "Mohamed Reda";

  const stats = useMemo(() => {
    const goals = board.items.filter((item) => item.kind === "goal").length;
    const wins = board.items.filter((item) => item.kind === "win").length;
    const pct = goals === 0 ? 0 : Math.min(100, Math.round((wins / goals) * 100));
    return { goals, wins, pct };
  }, [board.items]);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setBoard(loadBoard(CURRENT_YEAR));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  const cloneBoard = (value: BoardData): BoardData => JSON.parse(JSON.stringify(value)) as BoardData;

  const saveBoard = (next: BoardData, year = selectedYear, trackHistory = true) => {
    if (trackHistory) {
      historyRef.current.push(cloneBoard(boardRef.current));
      if (historyRef.current.length > 100) historyRef.current.shift();
      futureRef.current = [];
    }

    setBoard(next);
    localStorage.setItem(storageKey(year), JSON.stringify(next));
  };

  const addCard = (kind: BoardItemKind) => {
    const index = board.items.length;
    const next: BoardData = {
      ...board,
      items: [
        ...board.items,
        {
          id: nextId(kind),
          kind,
          text: kind === "goal" ? "new goal" : kind === "win" ? "new win" : "new focus",
          x: 70 + ((index * 36) % 620),
          y: 80 + ((index * 44) % 380),
          width: 220,
          height: 220,
          tilt: (index % 6) - 3,
        },
      ],
    };
    saveBoard(next);
    setSelectedIds([next.items[next.items.length - 1].id]);
  };

  const updateCardText = (id: string, text: string) => {
    const next = {
      ...board,
      items: board.items.map((item) => (item.id === id ? { ...item, text } : item)),
    };
    saveBoard(next);
  };

  const autoFitCardHeight = (id: string, contentEl: HTMLDivElement) => {
    const neededHeight = Math.min(520, Math.max(160, contentEl.scrollHeight + 78));
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

  const moveCard = (id: string, target: EventTarget | null) => {
    if (!boardAreaRef.current || !(target instanceof HTMLElement)) return;
    const current = boardRef.current;
    const draggedItem = current.items.find((item) => item.id === id);
    if (!draggedItem) return;
    const areaRect = boardAreaRef.current.getBoundingClientRect();
    const cardRect = target.getBoundingClientRect();
    const maxX = Math.max(0, areaRect.width - cardRect.width);
    const maxY = Math.max(0, areaRect.height - cardRect.height);
    const draggedX = Math.min(maxX, Math.max(0, cardRect.left - areaRect.left));
    const draggedY = Math.min(maxY, Math.max(0, cardRect.top - areaRect.top));
    const offsetX = draggedX - draggedItem.x;
    const offsetY = draggedY - draggedItem.y;
    const selectedSet =
      groupDrag && groupDrag.draggedId === id
        ? new Set(Object.keys(groupDrag.starts))
        : new Set(selectedIdsRef.current);
    const moveGroup = selectedSet.size > 1 && selectedSet.has(id);

    const next = {
      ...current,
      items: current.items.map((item) => {
        if (!moveGroup && item.id === id) {
          return { ...item, x: draggedX, y: draggedY };
        }
        if (moveGroup && selectedSet.has(item.id)) {
          const itemMaxX = Math.max(0, areaRect.width - item.width);
          const itemMaxY = Math.max(0, areaRect.height - item.height);
          return {
            ...item,
            x: Math.min(itemMaxX, Math.max(0, item.x + offsetX)),
            y: Math.min(itemMaxY, Math.max(0, item.y + offsetY)),
          };
        }
        return item;
      }),
    };
    saveBoard(next, selectedYear);
  };

  const startGroupDrag = (id: string) => {
    const selectedSet = new Set(selectedIdsRef.current);
    if (!(selectedSet.size > 1 && selectedSet.has(id))) {
      setGroupDrag(null);
      return;
    }

    const areaW = CANVAS_WIDTH;
    const areaH = CANVAS_HEIGHT;
    const starts: Record<string, { x: number; y: number; width: number; height: number }> = {};
    for (const item of boardRef.current.items) {
      if (!selectedSet.has(item.id)) continue;
      starts[item.id] = { x: item.x, y: item.y, width: item.width, height: item.height };
    }
    setGroupDrag({ draggedId: id, offsetX: 0, offsetY: 0, areaW, areaH, starts });
  };

  const dragGroupLive = (id: string, info: PanInfo) => {
    setGroupDrag((prev) => {
      if (!prev || prev.draggedId !== id) return prev;
      return { ...prev, offsetX: info.offset.x, offsetY: info.offset.y };
    });
  };

  const getItemPosition = (item: BoardItem) => {
    if (!groupDrag) return { left: item.x, top: item.y };
    const isGrouped = selectedIds.includes(item.id) && item.id !== groupDrag.draggedId;
    if (!isGrouped) return { left: item.x, top: item.y };
    const start = groupDrag.starts[item.id];
    if (!start) return { left: item.x, top: item.y };

    const maxX = Math.max(0, groupDrag.areaW - item.width);
    const maxY = Math.max(0, groupDrag.areaH - item.height);
    return {
      left: Math.min(maxX, Math.max(0, start.x + groupDrag.offsetX)),
      top: Math.min(maxY, Math.max(0, start.y + groupDrag.offsetY)),
    };
  };

  const togglePrivacy = () => {
    saveBoard({ ...board, isPublic: !board.isPublic });
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
    setResizingId(item.id);
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

      const width = Math.min(520, Math.max(160, active.startW + (event.clientX - active.startX)));
      const height = Math.min(520, Math.max(160, active.startH + (event.clientY - active.startY)));

      setBoard((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === active.id
            ? {
                ...item,
                width,
                height,
              }
            : item,
        ),
      }));
    };

    const handlePointerUp = () => {
      if (!resizeRef.current) return;
      resizeRef.current = null;
      setResizingId(null);
      setBoard((prev) => {
        localStorage.setItem(storageKey(CURRENT_YEAR), JSON.stringify(prev));
        return prev;
      });
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
      localStorage.setItem(storageKey(CURRENT_YEAR), JSON.stringify(previous));
    };

    const handleRedo = () => {
      const next = futureRef.current.shift();
      if (!next) return;
      historyRef.current.push(cloneBoard(boardRef.current));
      setBoard(next);
      localStorage.setItem(storageKey(CURRENT_YEAR), JSON.stringify(next));
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
        localStorage.setItem(storageKey(CURRENT_YEAR), JSON.stringify(next));
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
        localStorage.setItem(storageKey(CURRENT_YEAR), JSON.stringify(next));
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
        localStorage.setItem(storageKey(CURRENT_YEAR), JSON.stringify(next));
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
        localStorage.setItem(storageKey(CURRENT_YEAR), JSON.stringify(next));
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
        localStorage.setItem(storageKey(CURRENT_YEAR), JSON.stringify(next));
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
        localStorage.setItem(storageKey(CURRENT_YEAR), JSON.stringify(next));
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

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 font-[family-name:var(--font-space-grotesk)] text-slate-800">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,_rgba(15,23,42,0.16)_1px,transparent_1px)] bg-[size:16px_16px]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.8)_0%,rgba(241,245,249,0.92)_100%)]" />

      <main className="relative z-10 mx-auto h-screen max-w-[1600px] p-3 sm:p-5">
        <div className="flex items-start justify-between gap-4">
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
                <Chip size="sm" variant="flat" color="secondary">
                  free
                </Chip>
              </div>
            </CardBody>
          </Card>

          <Card className="w-full max-w-[420px] border border-slate-200/80 bg-white/95 shadow-md">
            <CardBody className="flex flex-row items-center justify-between gap-2 p-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-slate-800" />
                <Chip size="sm" variant="flat" color={board.isPublic ? "success" : "default"}>
                  {board.isPublic ? "public" : "private"}
                </Chip>
                <Chip size="sm" variant="flat" color="warning">
                  {stats.pct}%
                </Chip>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="flat" onPress={togglePrivacy}>
                  {board.isPublic ? "lock" : "publish"}
                </Button>
                <Button size="sm" color="primary">
                  share
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        <section
          ref={boardAreaRef}
          onPointerDown={startMarquee}
          className="relative mt-4 h-[calc(100vh-175px)] w-full overflow-hidden rounded-2xl border border-slate-200/70 bg-white/25 backdrop-blur-[2px]"
        >
          {board.items.length === 0 ? (
            <div className="grid h-full place-items-center text-slate-500">
              <p>start your board from the dock below.</p>
            </div>
          ) : (
            board.items.map((item, idx) => (
              (() => {
                const pos = getItemPosition(item);
                return (
                  <motion.article
                    key={item.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03, duration: 0.24 }}
                    drag={resizingId !== item.id}
                    dragMomentum={false}
                    dragElastic={0}
                    dragConstraints={boardAreaRef}
                    onDragStart={() => startGroupDrag(item.id)}
                    onDrag={(_, info) => dragGroupLive(item.id, info)}
                    onDragEnd={(event) => {
                      if (resizeRef.current?.id === item.id) return;
                      moveCard(item.id, event.currentTarget);
                      setGroupDrag(null);
                    }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  const multi = event.shiftKey || event.ctrlKey || event.metaKey;
                  if (multi) {
                    setSelectedIds((prev) =>
                      prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id],
                    );
                    return;
                  }
                  setSelectedIds((prev) => (prev.includes(item.id) ? prev : [item.id]));
                }}
                    className={`absolute flex cursor-grab flex-col rounded-sm border p-3 shadow-sm active:cursor-grabbing ${noteStyle()} ${
                      selectedIds.includes(item.id) ? "ring-2 ring-slate-500/50" : ""
                    }`}
                    style={{ left: pos.left, top: pos.top, width: item.width, height: item.height, zIndex: idx + 1 }}
                  >
                <Chip
                  size="sm"
                  variant="flat"
                  radius="sm"
                  className="absolute -top-3 left-3 border border-slate-300 bg-slate-100 px-2 text-[10px] font-medium uppercase tracking-wide text-slate-600"
                >
                  {kindLabel(item.kind)}
                </Chip>
                <div
                  className="flex-1 whitespace-pre-wrap rounded-sm bg-transparent p-2 text-sm leading-snug text-slate-700 outline-none ring-0"
                  contentEditable
                  suppressContentEditableWarning
                  onPointerDown={(event) => event.stopPropagation()}
                  onInput={(event) => autoFitCardHeight(item.id, event.currentTarget)}
                  onBlur={(event) => updateCardText(item.id, event.currentTarget.textContent ?? "")}
                >
                  {item.text}
                </div>
                <p className="mt-2 text-xs text-slate-500">{ownerName}</p>
                {selectedIds.includes(item.id) && (
                  <button
                    type="button"
                    aria-label="resize card"
                    className="absolute -bottom-2 -right-2 h-4 w-4 cursor-se-resize rounded-[4px] border-2 border-sky-500 bg-white shadow-sm"
                    onPointerDown={(event) => startResize(event, item)}
                  />
                )}
                  </motion.article>
                );
              })()
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
          <Card className="pointer-events-auto border border-slate-200/85 bg-white/95 shadow-lg">
            <CardBody className="flex flex-row items-center gap-2 p-2">
              <Tooltip content="add goal" delay={120}>
                <Button size="sm" variant="flat" isIconOnly onPress={() => addCard("goal")} aria-label="add goal">
                  <span className="sr-only">add goal</span>
                  <FiTarget className="text-sm" />
                </Button>
              </Tooltip>
              <Tooltip content="add win" delay={120}>
                <Button size="sm" variant="flat" isIconOnly onPress={() => addCard("win")} aria-label="add win">
                  <span className="sr-only">add win</span>
                  <FiAward className="text-sm" />
                </Button>
              </Tooltip>
              <Tooltip content="add focus" delay={120}>
                <Button size="sm" variant="flat" isIconOnly onPress={() => addCard("focus")} aria-label="add focus">
                  <span className="sr-only">add focus</span>
                  <FiEye className="text-sm" />
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
          </Card>
        </div>
      </main>
    </div>
  );
}
