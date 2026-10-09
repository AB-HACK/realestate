import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Edit, Trash2, Mail, Phone, DollarSign, MapPin,
  Plus, Send, Building2, Calendar, FileText, Clock,
} from "lucide-react";
import { useDataStore } from "@/stores/data-store";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { leadStatusConfig, leadStatusOrder, propertyStatusConfig, appointmentStatusConfig } from "@/lib/constants";
import { formatCurrency, formatDate, formatRelative, initials } from "@/lib/utils";
import type { LeadStatus } from "@/types";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clients, properties, appointments, documents, updateClientStatus, addClientNote, deleteClient } = useDataStore();
  const user = useAuthStore((s) => s.user);
  const [noteText, setNoteText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const client = clients.find((c) => c.id === id);

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="font-display text-xl font-bold">Client not found</h2>
        <Link to="/clients" className="mt-4"><Button variant="outline"><ArrowLeft className="h-4 w-4" /> Back to Clients</Button></Link>
      </div>
    );
  }

  const interestedProperties = properties.filter((p) => client.interestedPropertyIds.includes(p.id));
  const clientAppointments = appointments.filter((a) => a.clientId === client.id);
  const clientDocuments = documents.filter((d) => d.clientId === client.id);

  const handleAddNote = () => {
    if (!noteText.trim() || !user) return;
    addClientNote(client.id, noteText.trim(), user.id, `${user.firstName} ${user.lastName}`);
    setNoteText("");
  };

  const activityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    note: FileText, call: Phone, email: Mail, viewing: Building2,
    status_change: Clock, created: Plus,
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/clients"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Back to Clients</Button></Link>
        <div className="flex gap-2">
          <Link to={`/clients/${client.id}/edit`}><Button variant="outline" size="sm"><Edit className="h-4 w-4" /> Edit</Button></Link>
          <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <DialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /> Delete</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Delete this client?</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">This will permanently remove {client.firstName} {client.lastName} and all associated data.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                <Button variant="destructive" onClick={() => { deleteClient(client.id); navigate("/clients"); }}>Delete</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: profile + details */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardContent className="p-6 text-center">
              <Avatar className="mx-auto h-20 w-20">
                <AvatarFallback className="bg-primary/10 text-lg font-semibold">
                  {initials(`${client.firstName} ${client.lastName}`)}
                </AvatarFallback>
              </Avatar>
              <h2 className="mt-4 font-display text-xl font-bold">{client.firstName} {client.lastName}</h2>
              <Badge variant={leadStatusConfig[client.status].badge} className="mt-2">{leadStatusConfig[client.status].label}</Badge>
              <div className="mt-4 space-y-2 text-left text-sm">
                <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" /> {client.email}</p>
                <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" /> {client.phone}</p>
                <p className="flex items-center gap-2 text-muted-foreground"><DollarSign className="h-4 w-4" /> Budget: {formatCurrency(client.budget)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Preferred Locations</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {client.preferredLocations.map((loc) => (
                    <Badge key={loc} variant="secondary">{loc}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Property Types</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {client.propertyTypeInterest.map((type) => (
                    <Badge key={type} variant="muted">{type}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Update Status</CardTitle></CardHeader>
            <CardContent>
              <Select
                value={client.status}
                onValueChange={(v) => updateClientStatus(client.id, v as LeadStatus, user ? `${user.firstName} ${user.lastName}` : "System")}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {leadStatusOrder.map((s) => (
                    <SelectItem key={s} value={s}>{leadStatusConfig[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {/* Right: tabs content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Activity timeline */}
          <Card>
            <CardHeader><CardTitle>Activity Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {client.activities.map((act, i) => {
                  const Icon = activityIcons[act.type] ?? Clock;
                  return (
                    <div key={act.id} className="flex gap-3">
                      <div className="relative flex flex-col items-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        {i < client.activities.length - 1 && <div className="mt-1 h-full w-px bg-border" />}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm">{act.description}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{act.authorName} · {formatRelative(act.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Add a note..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
                />
                <Button onClick={handleAddNote} disabled={!noteText.trim()}><Send className="h-4 w-4" /></Button>
              </div>
              {client.notes.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                <div className="space-y-3">
                  {client.notes.map((note) => (
                    <div key={note.id} className="rounded-lg border border-border p-3">
                      <p className="text-sm">{note.content}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{note.authorName} · {formatDate(note.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Interested properties */}
          <Card>
            <CardHeader><CardTitle>Interested Properties</CardTitle></CardHeader>
            <CardContent>
              {interestedProperties.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No properties linked yet.</p>
              ) : (
                <div className="space-y-3">
                  {interestedProperties.map((p) => (
                    <Link key={p.id} to={`/properties/${p.id}`} className="flex items-center gap-3 rounded-lg border border-border p-3 transition-shadow hover:shadow-md">
                      <img src={p.images[0]} alt="" className="h-12 w-16 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground"><MapPin className="inline h-3 w-3" /> {p.location}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(p.price)}</p>
                        <Badge variant={propertyStatusConfig[p.status].badge} className="mt-0.5">{propertyStatusConfig[p.status].label}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Appointments */}
          <Card>
            <CardHeader><CardTitle>Appointments</CardTitle></CardHeader>
            <CardContent>
              {clientAppointments.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No appointments scheduled.</p>
              ) : (
                <div className="space-y-3">
                  {clientAppointments.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                      <img src={a.propertyImage} alt="" className="h-12 w-12 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.propertyTitle}</p>
                        <p className="text-xs text-muted-foreground"><Calendar className="inline h-3 w-3" /> {formatDate(a.date)} at {a.time}</p>
                      </div>
                      <Badge variant={appointmentStatusConfig[a.status].badge}>{appointmentStatusConfig[a.status].label}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
