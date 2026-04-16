"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { MessageCircle, Send } from "lucide-react";

interface SocialWidgetData {
  whatsapp_number: string;
  telegram_number: string;
}

export function SocialWidget(_props: { sidebarCollapsed?: boolean }) {
  const { data } = useQuery<SocialWidgetData>({
    queryKey: ["social-widget"],
    queryFn: async () => (await api.get("/dashboard/social-widget")).data,
    staleTime: 1000 * 60 * 30, // 30 min
  });

  if (!data) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
      {data.whatsapp_number && (
        <a
          href={`https://wa.me/${data.whatsapp_number.replace(/[^0-9]/g, "")}?text=Hi%2C%20I%20need%20help`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition-transform hover:scale-110"
          title="WhatsApp Support"
        >
          <MessageCircle className="h-6 w-6" />
        </a>
      )}
      {data.telegram_number && (
        <a
          href={`https://t.me/${data.telegram_number}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg transition-transform hover:scale-110"
          title="Telegram Support"
        >
          <Send className="h-6 w-6" />
        </a>
      )}
    </div>
  );
}
