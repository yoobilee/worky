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
import {
  getUserNotifications,
  markUserNotificationRead,
  markAllUserNotificationsRead,
  type UserNotification,
} from "@/lib/db/user_notifications";

interface NotificationBellProps {
  userId: string | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

const TYPE_META: Record<string, { icon: typeof IconSparkles; color: string }> = {
  patch:    { icon: IconSparkles,    color: "text-purple-500" },
  schedule: { icon: IconCalendar,    color: "text-blue-500"   },
  notice:   { icon: IconInfoCircle,  color: "text-orange-500" },
};

type UnifiedItem = {
  id: string;
  title: string;
  content: string;
  type: string;
  created_at: string;
  isUnread: boolean;
  source: "global" | "personal";
};

export default function NotificationBell({ userId }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [personalNotifs, setPersonalNotifs] = useState<UserNotification[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [overflowIds, setOverflowIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRefs = useRef<Map<string, HTMLParagraphElement>>(new Map());

  const fetchData = async () => {
    const list = await getAnnouncements();
    setAnnouncements(list);
    const personal = userId ? await getUserNotifications(userId) : [];
    setPersonalNotifs(personal);
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

  useEffect(() => {
    if (!open) return;
    const overflowing = new Set<string>();
    contentRefs.current.forEach((el, id) => {
      if (el.scrollHeight > el.clientHeight) {
        overflowing.add(id);
      }
    });
    setOverflowIds(overflowing);
  }, [open, announcements, personalNotifs]);

  const unifiedList: UnifiedItem[] = [
    ...announcements.map(a => ({
      id: a.id,
      title: a.title,
      content: a.content,
      type: a.type,
      created_at: a.created_at,
      isUnread: !readIds.has(a.id),
      source: "global" as const,
    })),
    ...personalNotifs.map(p => ({
      id: p.id,
      title: p.title,
      content: p.content,
      type: p.type,
      created_at: p.created_at,
      isUnread: !p.is_read,
      source: "personal" as const,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const totalUnread = unreadCount + personalNotifs.filter(p => !p.is_read).length;

  const handleItemClick = async (item: UnifiedItem) => {
    const willExpand = expandedId !== item.id;
    setExpandedId(willExpand ? item.id : null);
    if (!willExpand || !item.isUnread) return;
    if (item.source === "global") {
      if (!userId || readIds.has(item.id)) return;
      setReadIds(prev => new Set(prev).add(item.id));
      setUnreadCount(prev => Math.max(0, prev - 1));
      await markAsRead(userId, item.id);
    } else {
      setPersonalNotifs(prev => prev.map(p => p.id === item.id ? { ...p, is_read: true } : p));
      await markUserNotificationRead(item.id);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!userId) return;
    const ids = announcements.map(a => a.id);
    setReadIds(new Set(ids));
    setUnreadCount(0);
    setPersonalNotifs(prev => prev.map(p => ({ ...p, is_read: true })));
    await Promise.all([markAllAsRead(userId, ids), markAllUserNotificationsRead(userId)]);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label="알림"
        className="group relative p-2 rounded-lg text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
      >
        <IconBell className="w-5 h-5 group-hover:animate-[bell-ring_0.5s_ease-in-out]" />
        {totalUnread > 0 && (
          <span className="absolute top-1 right-1 flex w-2 h-2">
            <span className="absolute inline-flex w-full h-full rounded-full bg-red-500 opacity-75 animate-ping" />
            <span className="relative inline-flex w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-zinc-900" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white/[0.82] dark:bg-zinc-900/[0.82] backdrop-blur-xl backdrop-saturate-150 rounded-2xl border border-white/60 dark:border-white/10 shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-zinc-200">알림</h3>
            <button
              onClick={handleMarkAllAsRead}
              className="text-xs font-medium text-[#4D44CC] dark:text-[#8B85FF] hover:underline"
            >
              모두 읽음
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {unifiedList.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-zinc-400 text-center py-8">새로운 알림이 없습니다</p>
            ) : (
              unifiedList.map((item) => {
                const meta = TYPE_META[item.type] ?? TYPE_META.notice;
                const Icon = meta.icon;
                const isExpanded = expandedId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="flex items-start gap-3 w-full text-left px-4 py-3 border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 transition last:border-b-0"
                  >
                    <span className="mt-1 shrink-0">
                      {item.isUnread && <span className="block w-1.5 h-1.5 rounded-full bg-[#6C63FF]" />}
                    </span>
                    <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${meta.color}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-700 dark:text-zinc-200 truncate">{item.title}</p>
                      <p
                        ref={(el) => {
                          if (el) contentRefs.current.set(item.id, el);
                          else contentRefs.current.delete(item.id);
                        }}
                        className={`text-xs text-slate-500 dark:text-zinc-400 mt-0.5 whitespace-pre-line transition-all duration-300 ease-in-out ${
                          isExpanded ? "line-clamp-none" : "line-clamp-2"
                        }`}
                      >
                        {item.content}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">{formatDate(item.created_at)}</p>
                    </div>
                    {overflowIds.has(item.id) && (
                      <span className="shrink-0 mt-1 text-slate-500 dark:text-zinc-400">
                        {isExpanded ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />}
                      </span>
                    )}
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
