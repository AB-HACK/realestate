import { useState, useMemo } from "react";
import { FileText, Search, Download, Trash2, Plus, FileType } from "lucide-react";
import { useDataStore } from "@/stores/data-store";
import { useAuthStore } from "@/stores/auth-store";
import { PageHeader, EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import type { DocumentItem } from "@/types";

const docTypeConfig: Record<string, { label: string; badge: "info" | "warning" | "success" | "muted" | "default" }> = {
  contract: { label: "Contract", badge: "default" },
  id: { label: "ID", badge: "warning" },
  inspection: { label: "Inspection", badge: "info" },
  offer: { label: "Offer", badge: "success" },
  other: { label: "Other", badge: "muted" },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const { documents, properties, clients, addDocument, deleteDocument } = useDataStore();
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newDoc, setNewDoc] = useState({ name: "", type: "other", propertyId: "", clientId: "" });

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "all" || d.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [documents, search, typeFilter]);

  const handleAdd = () => {
    if (!newDoc.name.trim() || !user) return;
    const doc: DocumentItem = {
      id: `d-${Date.now()}`,
      name: newDoc.name.trim(),
      type: newDoc.type as DocumentItem["type"],
      fileType: "pdf",
      size: 250_000,
      url: "#",
      propertyId: newDoc.propertyId || undefined,
      clientId: newDoc.clientId || undefined,
      uploadedById: user.id,
      uploadedByName: `${user.firstName} ${user.lastName}`,
      createdAt: new Date().toISOString(),
    };
    addDocument(doc);
    setDialogOpen(false);
    setNewDoc({ name: "", type: "other", propertyId: "", clientId: "" });
    toast.success("Document uploaded", `"${doc.name}" has been added to your library.`);
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <PageHeader title="Documents" description={`${documents.length} documents in your library.`}>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Upload Document</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Document Name</Label>
                <Input placeholder="e.g. Purchase Agreement.pdf" value={newDoc.name} onChange={(e) => setNewDoc((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={newDoc.type} onValueChange={(v) => setNewDoc((p) => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(docTypeConfig).map(([key, cfg]) => <SelectItem key={key} value={key}>{cfg.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Link to Property (optional)</Label>
                  <Select value={newDoc.propertyId} onValueChange={(v) => setNewDoc((p) => ({ ...p, propertyId: v }))}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Link to Client (optional)</Label>
                  <Select value={newDoc.clientId} onValueChange={(v) => setNewDoc((p) => ({ ...p, clientId: v }))}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={!newDoc.name.trim()}>Upload</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search documents..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(docTypeConfig).map(([key, cfg]) => <SelectItem key={key} value={key}>{cfg.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No documents found" description="Upload contracts, IDs, inspection reports, or other files." />
      ) : (
        <Card className="divide-y divide-border p-0">
          {filtered.map((doc) => {
            const property = properties.find((p) => p.id === doc.propertyId);
            const client = clients.find((c) => c.id === doc.clientId);
            return (
              <div key={doc.id} className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <FileType className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{doc.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={docTypeConfig[doc.type].badge}>{docTypeConfig[doc.type].label}</Badge>
                    <span>{formatFileSize(doc.size)}</span>
                    <span>·</span>
                    <span>Uploaded by {doc.uploadedByName}</span>
                    <span>·</span>
                    <span>{formatDate(doc.createdAt)}</span>
                    {property && <span>· <span className="font-medium text-foreground">{property.title}</span></span>}
                    {client && <span>· <span className="font-medium text-foreground">{client.firstName} {client.lastName}</span></span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { /* placeholder download */ }}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { deleteDocument(doc.id); toast.success("Document deleted", `"${doc.name}" has been removed.`); }} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
