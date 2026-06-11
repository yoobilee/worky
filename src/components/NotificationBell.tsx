"use client";

import { useState, useRef, useEffect } from "react";
import { IconBell, IconSparkles, IconCalendar, IconInfoCircle, IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import {
  getAnnouncements,
  getReadIds,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  type Announcement,
} from "@/lib/db/announcements";

interface NotificationBellProps {
  userId: string | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

const TYPE_META: Record<Announcement["type"], { icon: typeof IconSparkles; color: string }> = {
  patch: { icon: IconSparkles, color: "text-purple-500" },
  schedule: { icon: IconCalendar, color: "text-blue-500" },
  notice: { icon: IconInfoCircle, color: "text-orange-500" },
};

export default function NotificationBell({ userId }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    const list = await getAnnouncements();
    setAnnouncements(list);
    if (userId) {
      const [ids, count] = await Promise.all([getReadIds(userId), getUnreadCount(userId)]);
      setReadIds(ids);
      setUnreadCount(count);
    } else {
      setReadIds(new Set());
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (open) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleItemClick = async (announcementId: string) => {
    setExpandedId((prev) => (prev === announcementId ? null : announcementId));

    if (!userId || readIds.has(announcementId)) return;
    setReadIds((prev) => new Set(prev).add(announcementId));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    await markAsRead(userId, announcementId);
  };

  const handleMarkAllAsRead = async () => {
    if (!userId) return;
    const ids = announcements.map((a) => a.id);
    setReadIds(new Set(ids));
    setUnreadCount(0);
    await markAllAsRead(userId, ids);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label="알림"
        className="relative p-2 rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
      >
        <IconBell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-zinc-900" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-zinc-200">알림</h3>
            <button
              onClick={handleMarkAllAsRead}
              className="text-xs font-medium text-[#6C63FF] hover:underline"
            >
              모두 읽음
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {announcements.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-zinc-500 text-center py-8">새로운 알림이 없습니다</p>
            ) : (
              announcements.map((a) => {
                const meta = TYPE_META[a.type] ?? TYPE_META.notice;
                const Icon = meta.icon;
                const isUnread = !readIds.has(a.id);
                const isExpanded = expandedId === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => handleItemClick(a.id)}
                    className="flex items-start gap-3 w-full text-left px-4 py-3 border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 transition last:border-b-0"
                  >
                    <span className="mt-1 shrink-0">
                      {isUnread && <span className="block w-1.5 h-1.5 rounded-full bg-[#6C63FF]" />}
                    </span>
                    <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${meta.color}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-700 dark:text-zinc-200 truncate">{a.title}</p>
                      <p
                        className={`text-xs text-slate-500 dark:text-zinc-400 mt-0.5 transition-all duration-300 ease-in-out ${
                          isExpanded ? "line-clamp-none" : "line-clamp-2"
                        }`}
                      >
                        {a.content}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">{formatDate(a.created_at)}</p>
                    </div>
                    <span className="shrink-0 mt-1 text-slate-400 dark:text-zinc-500">
                      {isExpanded ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
