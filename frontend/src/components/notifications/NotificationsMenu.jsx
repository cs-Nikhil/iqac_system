import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationsAPI } from '../../services/api';

const formatNotificationDate = (value) => {
  if (!value) {
    return 'Just now';
  }

  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getNotificationToneClass = (type) => {
  if (type === 'placement') return 'badge badge-warning';
  if (type === 'event') return 'badge badge-success';
  return 'badge badge-info';
};

export default function NotificationsMenu() {
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    setLoading(true);

    try {
      const response = await notificationsAPI.getAll({ limit: 8 });
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error('Unable to load notifications:', error);
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleDocumentClick = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [open]);

  const unreadIds = useMemo(
    () => notifications.filter((notification) => !notification.isRead).map((notification) => notification._id),
    [notifications]
  );

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      try {
        await notificationsAPI.markRead(notification._id);
        setNotifications((current) =>
          current.map((entry) =>
            entry._id === notification._id ? { ...entry, isRead: true } : entry
          )
        );
        setUnreadCount((current) => Math.max(0, current - 1));
      } catch (error) {
        console.error('Unable to mark notification as read:', error);
      }
    }

    if (notification.route) {
      navigate(notification.route);
      setOpen(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (!unreadIds.length) {
      return;
    }

    try {
      await notificationsAPI.markAllRead();
      setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Unable to mark all notifications as read:', error);
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="btn-secondary relative h-10 w-10 p-0"
        aria-label="Notifications"
      >
        <Bell size={15} />
        {unreadCount ? (
          <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[22rem] rounded-[24px] border border-line/70 bg-panel/95 p-4 shadow-elevated backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Notifications</p>
              <p className="mt-1 text-sm text-content-muted">
                {unreadCount ? `${unreadCount} unread update${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
              </p>
            </div>
            <button
              type="button"
              className="btn-ghost h-9 px-3 text-xs"
              onClick={handleMarkAllRead}
              disabled={!unreadIds.length}
            >
              <CheckCheck size={14} />
              Mark all
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <>
                <div className="skeleton min-h-[5.25rem] rounded-[18px]" />
                <div className="skeleton min-h-[5.25rem] rounded-[18px]" />
              </>
            ) : notifications.length ? (
              notifications.map((notification) => (
                <button
                  key={notification._id}
                  type="button"
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full rounded-[18px] border p-4 text-left transition hover:-translate-y-0.5 ${
                    notification.isRead
                      ? 'border-line/60 bg-panel-muted/50'
                      : 'border-brand-400/20 bg-brand-500/8'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={getNotificationToneClass(notification.type)}>
                          {notification.type || 'system'}
                        </span>
                        {!notification.isRead ? <span className="badge badge-info">New</span> : null}
                      </div>
                      <p className="mt-3 text-sm font-semibold text-content-primary">{notification.title}</p>
                      <p className="mt-2 text-sm leading-6 text-content-secondary">{notification.message}</p>
                    </div>
                    {notification.route ? <ExternalLink size={15} className="mt-1 shrink-0 text-content-muted" /> : null}
                  </div>
                  <p className="mt-3 text-xs text-content-muted">{formatNotificationDate(notification.createdAt)}</p>
                </button>
              ))
            ) : (
              <div className="empty-state min-h-[10rem]">No notifications yet.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
