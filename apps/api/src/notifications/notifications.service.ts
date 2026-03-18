import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { randomUUID } from 'crypto';

export interface Notification {
  id: string;
  userId: string;
  type: string; // 'device_expiry' | 'credit_received' | 'announcement' | 'system'
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

@Injectable()
export class NotificationsService {
  private notifications = new Map<string, Notification[]>(); // userId -> notifications (in-memory)
  private events$ = new Subject<{ userId: string; notification: Notification }>();

  emit(userId: string, type: string, title: string, message: string) {
    const notification: Notification = {
      id: randomUUID(),
      userId,
      type,
      title,
      message,
      read: false,
      createdAt: new Date(),
    };

    const userNotifications = this.notifications.get(userId) || [];
    userNotifications.unshift(notification);
    // Keep max 50 per user
    if (userNotifications.length > 50) userNotifications.pop();
    this.notifications.set(userId, userNotifications);

    this.events$.next({ userId, notification });
    return notification;
  }

  getForUser(userId: string): Notification[] {
    return this.notifications.get(userId) || [];
  }

  getUnreadCount(userId: string): number {
    return (this.notifications.get(userId) || []).filter((n) => !n.read).length;
  }

  markAllRead(userId: string) {
    const list = this.notifications.get(userId) || [];
    list.forEach((n) => (n.read = true));
    return { marked: list.length };
  }

  subscribe(userId: string): Observable<MessageEvent> {
    return this.events$.pipe(
      filter((e) => e.userId === userId),
      map(
        (e) => ({ data: JSON.stringify(e.notification) }) as MessageEvent,
      ),
    );
  }
}
