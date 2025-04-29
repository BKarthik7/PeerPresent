import { usePresentation } from "@/contexts/presentation-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";

export function PeerList() {
  const { peers } = usePresentation();

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center">
          <ClipboardList className="h-5 w-5 mr-2" />
          Connected Peers
        </CardTitle>
      </CardHeader>
      <CardContent>
        {peers.length > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {peers.map((peer) => (
                <div key={peer.id} className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-sm">{peer.name}</span>
                </div>
              ))}
            </div>
            <div className="pt-2">
              <Badge variant="outline" className="text-xs">
                {peers.length} peer{peers.length !== 1 ? "s" : ""} connected
              </Badge>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
              <ClipboardList className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No peers connected</p>
            <p className="text-xs text-muted-foreground mt-1">
              Waiting for participants to join...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}