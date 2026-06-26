"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { IconPlus, IconX, IconUserPlus, IconRotate } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import { getDesks, addDesk, updateDeskPosition, assignDeskMember, deleteDesk, updateDeskRotation } from "@/lib/db/seating";
import type { Desk } from "@/types/seating";
import type { Member } from "@/types/member";

interface SeatingPlannerProps {
  members: Member[];
  avatarGradient: (id: string) => string;
}

const PLAN_WIDTH = 1800;
const PLAN_HEIGHT = 1000;
const DESK_WIDTH = 130;
const DESK_HEIGHT = 64;
const SNAP_THRESHOLD = 6;

export default function SeatingPlanner({ members, avatarGradient }: SeatingPlannerProps) {
  const [hydrated, setHydrated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [desks, setDesks] = useState<Desk[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [assignOpenId, setAssignOpenId] = useState<string | null>(null);
  const planRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const movedRef = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) setDesks(await getDesks(uid));
      setHydrated(true);
    });
  }, []);

  const handleAddDesk = async () => {
    if (!userId) return;
    const x = PLAN_WIDTH / 2 - DESK_WIDTH / 2;
    const y = PLAN_HEIGHT / 2 - DESK_HEIGHT / 2;
    const desk = await addDesk(userId, x, y);
    if (desk) setDesks(prev => [...prev, desk]);
  };

  const handleDeleteDesk = async (id: string) => {
    await deleteDesk(id);
    setDesks(prev => prev.filter(d => d.id !== id));
  };

  const handleAssign = async (deskId: string, memberId: string | null) => {
    await assignDeskMember(deskId, memberId);
    setDesks(prev => prev.map(d => d.id === deskId ? { ...d, memberId } : d));
    setAssignOpenId(null);
  };

  const startDrag = (e: React.PointerEvent, desk: Desk) => {
    movedRef.current = false;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
    const planRect = planRef.current?.getBoundingClientRect();
    if (!planRect) return;
    dragOffset.current = {
      x: e.clientX - planRect.left - desk.x,
      y: e.clientY - planRect.top - desk.y,
    };
    setDraggingId(desk.id);
  };

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!draggingId) return;
    const planRect = planRef.current?.getBoundingClientRect();
    if (!planRect) return;
    let x = e.clientX - planRect.left - dragOffset.current.x;
    let y = e.clientY - planRect.top - dragOffset.current.y;
    const dist = Math.hypot(e.clientX - dragStartPos.current.x, e.clientY - dragStartPos.current.y);
    if (dist > 4) movedRef.current = true;
    const draggingDesk = desks.find(d => d.id === draggingId);
    const rotated = draggingDesk && (draggingDesk.rotation === 90 || draggingDesk.rotation === 270);
    const effW = rotated ? DESK_HEIGHT : DESK_WIDTH;
    const effH = rotated ? DESK_WIDTH : DESK_HEIGHT;
    x = Math.max(0, Math.min(PLAN_WIDTH - effW, x));
    y = Math.max(0, Math.min(PLAN_HEIGHT - effH, y));

    let snapX: number | null = null;
    let snapY: number | null = null;
    for (const other of desks) {
      if (other.id === draggingId) continue;
      if (Math.abs(other.x - x) < SNAP_THRESHOLD) { x = other.x; snapX = other.x; }
      if (Math.abs((other.x + DESK_WIDTH / 2) - (x + DESK_WIDTH / 2)) < SNAP_THRESHOLD) { x = other.x; snapX = other.x; }
      if (Math.abs(other.y - y) < SNAP_THRESHOLD) { y = other.y; snapY = other.y; }
      if (Math.abs((other.y + DESK_HEIGHT / 2) - (y + DESK_HEIGHT / 2)) < SNAP_THRESHOLD) { y = other.y; snapY = other.y; }
    }
    setGuides({ x: snapX, y: snapY });
    setDesks(prev => prev.map(d => d.id === draggingId ? { ...d, x, y } : d));
  }, [draggingId, desks]);

  const onPointerUp = useCallback(() => {
    if (!draggingId) return;
    const desk = desks.find(d => d.id === draggingId);
    setDraggingId(null);
    setGuides({ x: null, y: null });
    if (desk) updateDeskPosition(desk.id, desk.x, desk.y);
  }, [draggingId, desks]);

  useEffect(() => {
    if (!draggingId) return;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [draggingId, onPointerMove, onPointerUp]);

  if (!hydrated) {
    return <div className="animate-pulse bg-slate-200 dark:bg-zinc-700/50 rounded-2xl" style={{ width: PLAN_WIDTH, height: PLAN_HEIGHT, maxWidth: "100%" }} />;
  }

  const getMember = (id: string | null) => id ? members.find(m => m.id === id) ?? null : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400 dark:text-zinc-500">책상을 드래그해서 자유롭게 배치하세요</p>
        <button onClick={handleAddDesk}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition"
          style={{ background: "linear-gradient(135deg, #6C63FF, #8B85FF)" }}>
          <IconPlus className="w-4 h-4" />책상 추가
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
      <div className="overflow-auto bg-slate-50 dark:bg-zinc-950/40 p-4">
        <div
          ref={planRef}
          className="relative rounded-xl shrink-0 mx-auto dark:bg-zinc-900"
          style={{
            width: PLAN_WIDTH,
            height: PLAN_HEIGHT,
            backgroundColor: "var(--grid-bg, #ffffff)",
            backgroundImage: "linear-gradient(to right, rgba(108,99,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(108,99,255,0.08) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        >

          {guides.x !== null && (
            <div className="absolute top-0 bottom-0 w-px bg-[#6C63FF]/60 pointer-events-none" style={{ left: guides.x + DESK_WIDTH / 2 }} />
          )}
          {guides.y !== null && (
            <div className="absolute left-0 right-0 h-px bg-[#6C63FF]/60 pointer-events-none" style={{ top: guides.y + DESK_HEIGHT / 2 }} />
          )}

          {desks.map(desk => {
            const member = getMember(desk.memberId);
            const isDragging = draggingId === desk.id;
            return (
              <div key={desk.id}
                onPointerDown={(e) => startDrag(e, desk)}
                className={[
                  "absolute rounded-xl border-2 flex items-center gap-2 px-2.5 cursor-grab select-none transition-shadow group",
                  isDragging ? "shadow-xl cursor-grabbing z-10" : "shadow-sm hover:shadow-md",
                  member ? "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" : "border-dashed border-slate-300 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-800/50",
                ].join(" ")}
                style={{ left: desk.x, top: desk.y, width: DESK_WIDTH, height: DESK_HEIGHT, transform: `rotate(${desk.rotation ?? 0}deg)` }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); if (movedRef.current) return; setAssignOpenId(assignOpenId === desk.id ? null : desk.id); }}
                  className="flex items-center gap-2 w-full min-w-0 text-left"
                >
                  {member ? (
                    <>
                      <div className="w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: avatarGradient(member.id) }}>
                        {member.name.charAt(0)}
                      </div>
                      <span className="text-xs font-medium text-slate-700 dark:text-zinc-200 truncate">{member.name}</span>
                    </>
                  ) : (
                    <>
                      <IconUserPlus className="w-5 h-5 text-slate-300 dark:text-zinc-600 shrink-0" />
                      <span className="text-xs text-slate-400 dark:text-zinc-500">배정</span>
                    </>
                  )}
                </button>
                <div className="absolute -top-2 -right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (movedRef.current) return;
                      const next = ((desk.rotation ?? 0) + 90) % 360;
                      setDesks(prev => prev.map(d => d.id === desk.id ? { ...d, rotation: next } : d));
                      updateDeskRotation(desk.id, next);
                    }}
                    className="w-5 h-5 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-sm flex items-center justify-center text-[#6C63FF] hover:bg-[#6C63FF]/10 transition"
                  >
                    <IconRotate className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteDesk(desk.id); }}
                    className="w-5 h-5 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-sm flex items-center justify-center text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                  >
                    <IconX className="w-3 h-3" />
                  </button>
                </div>

                {assignOpenId === desk.id && (
                  <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-lg w-44 overflow-hidden">
                    <div className="max-h-52 overflow-y-auto">
                      <button onClick={(e) => { e.stopPropagation(); handleAssign(desk.id, null); }}
                        className="w-full px-3 py-2 text-xs text-left text-slate-400 dark:text-zinc-500 hover:bg-slate-50 dark:hover:bg-zinc-800 transition">
                        비우기
                      </button>
                      {members.map(m => (
                        <button key={m.id} onClick={(e) => { e.stopPropagation(); handleAssign(desk.id, m.id); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition">
                          <div className="w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-bold shrink-0"
                            style={{ background: avatarGradient(m.id) }}>
                            {m.name.charAt(0)}
                          </div>
                          <span className="truncate">{m.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
}
