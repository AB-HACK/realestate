import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Plus, CalendarDays, Clock, MapPin, Calendar as CalendarIcon, List } from "lucide-react";
import { useDataStore } from "@/stores/data-store";
import { PageHeader, EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { appointmentStatusConfig, propertyStatusConfig } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { Appointment, AppointmentStatus } from "@/types";

const statuses: AppointmentStatus[] = ["scheduled", "completed", "cancelled", "no_show"];

export default function AppointmentsPage() {
  const { appointments, properties, clients, addAppointment, updateAppointment } = useDataStore();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newAppt, setNewAppt] = useState({ propertyId: "", clientId: "", date: "", time: "10:00", notes: "" });

  const filtered = useMemo(() => {
    return [...appointments]
      .filter((a) => statusFilter === "all" || a.status === statusFilter)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [appointments, statusFilter]);

  const calendarDays = useMemo(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d;
    });
  }, []);

  const handleCreate = () => {
    if (!newAppt.propertyId || !newAppt.clientId || !newAppt.date) return;
    const property = properties.find((p) => p.id === newAppt.propertyId);
    const client = clients.find((c) => c.id === newAppt.clientId);
    if (!property || !client) return;
    const appt: Appointment = {
      id: `ap-${Date.now()}`,
      propertyId: property.id,
      propertyTitle: property.title,
      propertyImage: property.images[0],
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      agentId: "u-2",
      agentName: "James Carter",
      date: newAppt.date,
      time: newAppt.time,
      duration: 60,
      status: "scheduled",
      notes: newAppt.notes,
      createdAt: new Date().toISOString(),
    };
    addAppointment(appt);
    setDialogOpen(false);
    setNewAppt({ propertyId: "", clientId: "", date: "", time: "10:00", notes: "" });
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      <PageHeader title="Appointments" description={`${appointments.filter((a) => a.status === "scheduled").length} upcoming viewings scheduled.`}>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Schedule Viewing</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Schedule a Viewing</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Property</Label>
                <Select value={newAppt.propertyId} onValueChange={(v) => setNewAppt((p) => ({ ...p, propertyId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={newAppt.clientId} onValueChange={(v) => setNewAppt((p) => ({ ...p, clientId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={newAppt.date} onChange={(e) => setNewAppt((p) => ({ ...p, date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input type="time" value={newAppt.time} onChange={(e) => setNewAppt((p) => ({ ...p, time: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input placeholder="Optional notes..." value={newAppt.notes} onChange={(e) => setNewAppt((p) => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Schedule</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {statuses.map((s) => <SelectItem key={s} value={s}>{appointmentStatusConfig[s].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex rounded-lg border border-border p-0.5">
          <button onClick={() => setView("list")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><List className="h-3.5 w-3.5" /> List</button>
          <button onClick={() => setView("calendar")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${view === "calendar" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}><CalendarIcon className="h-3.5 w-3.5" /> Calendar</button>
        </div>
      </div>

      {filtered.length === 0 && view === "list" ? (
        <EmptyState icon={CalendarDays} title="No appointments found" description="Schedule a property viewing to get started." />
      ) : view === "list" ? (
        <div className="space-y-3">
          {filtered.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-4">
                  <img src={a.propertyImage} alt="" className="h-16 w-20 rounded-lg object-cover" />
                  <div className="min-w-0">
                    <Link to={`/properties/${a.id}`} className="font-medium hover:underline">{a.propertyTitle}</Link>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> {formatDate(a.date)}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {a.time} ({a.duration}min)</span>
                      <span>Client: {a.clientName}</span>
                      <span>Agent: {a.agentName}</span>
                    </div>
                    {a.notes && <p className="mt-1 text-xs text-muted-foreground italic">{a.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:ml-auto">
                  <Badge variant={appointmentStatusConfig[a.status].badge}>{appointmentStatusConfig[a.status].label}</Badge>
                  {a.status === "scheduled" && (
                    <Select onValueChange={(v) => updateAppointment(a.id, { status: v as AppointmentStatus })}>
                      <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Update" /></SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => <SelectItem key={s} value={s}>{appointmentStatusConfig[s].label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-7">
          {calendarDays.map((day) => {
            const dayStr = day.toISOString().split("T")[0];
            const dayAppts = appointments.filter((a) => a.date === dayStr);
            const isToday = dayStr === new Date().toISOString().split("T")[0];
            return (
              <div key={dayStr} className={`min-h-[140px] rounded-lg border p-2 ${isToday ? "border-primary bg-primary/5" : "border-border"}`}>
                <p className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                  {day.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}
                </p>
                <div className="mt-1 space-y-1">
                  {dayAppts.map((a) => (
                    <Link key={a.id} to={`/properties/${a.id}`} className="block rounded-md bg-accent/50 px-2 py-1 text-xs transition-colors hover:bg-accent">
                      <p className="truncate font-medium">{a.time} — {a.clientName}</p>
                      <p className="truncate text-muted-foreground">{a.propertyTitle}</p>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
