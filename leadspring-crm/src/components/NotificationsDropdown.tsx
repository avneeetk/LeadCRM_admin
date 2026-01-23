import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  doc,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type AdminNotification = {
  id: string;
  message: string;
  read: boolean;
  createdAt?: any;
  type?: string;
  title?: string;
};

export function NotificationsDropdown() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "admin_notifications"),
      orderBy("createdAt", "desc"),
      limit(30)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setNotifications(
          snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              message: typeof data.message === "string" ? data.message : "",
              title: typeof data.title === "string" ? data.title : "",
              read: typeof data.read === "boolean" ? data.read : false,
              createdAt: data.createdAt,
              type: data.type,
            };
          })
        );
        setLoading(false);
      },
      (error) => {
        console.error("Notifications listener error:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const unreadCount = notifications.filter((n) => n.read === false).length;

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => n.read === false);
    await Promise.all(
      unread.map(async (n) => {
        try {
          await updateDoc(doc(db, "admin_notifications", n.id), { read: true });
        } catch (e) {
          console.error("Failed to mark notification read:", n.id, e);
        }
      })
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={markAllAsRead}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <ScrollArea className="h-[300px]">
          {loading && (
            <div className="p-4 text-sm text-muted-foreground">
              Loading notifications…
            </div>
          )}

          {!loading && notifications.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">
              No notifications yet
            </div>
          )}

          {notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id || Math.random().toString()}
              className={`flex flex-col items-start p-3 cursor-pointer ${
                !notification.read ? "bg-muted/50" : ""
              }`}
            >
              <div className="flex items-start gap-2 w-full">
                <span className="text-lg">🔔</span>
                <div className="flex-1 min-w-0">
                  {notification.title && (
                    <p className="text-xs font-semibold text-muted-foreground">
                      {notification.title}
                    </p>
                  )}
                  <p className="text-sm font-medium">
                    {notification.message || "Notification"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {notification.createdAt?.toDate
                      ? notification.createdAt
                          .toDate()
                          .toLocaleString()
                      : ""}
                  </p>
                </div>
                {!notification.read && (
                  <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </ScrollArea>

        <DropdownMenuSeparator />

        <DropdownMenuItem className="justify-center text-sm text-primary cursor-pointer">
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
