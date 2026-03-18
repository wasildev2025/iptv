"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Announcement } from "@/types";

export default function OffersPage() {
  const { data: announcements, isLoading } = useQuery<Announcement[]>({
    queryKey: ["announcements"],
    queryFn: async () => (await api.get("/dashboard/announcements")).data,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-red-600">Reseller Offers List</h1>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : !announcements?.length ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No offers or notifications at this time.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <Card key={a.id} className="border-l-4 border-l-red-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-red-600">{a.title}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {new Date(a.createdAt).toLocaleDateString()}
                </p>
              </CardHeader>
              <CardContent>
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: a.body }}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
