import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Users, Mail, Phone, DollarSign } from "lucide-react";
import { useDataStore } from "@/stores/data-store";
import { PageHeader, EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { leadStatusConfig, leadStatusOrder } from "@/lib/constants";
import { formatCurrency, formatRelative, initials } from "@/lib/utils";
import type { LeadStatus } from "@/types";

export default function ClientsPage() {
  const { clients } = useDataStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [view, setView] = useState<"list" | "pipeline">("list");

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const matchSearch =
        !search ||
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [clients, search, statusFilter]);

  return (
    <div className="animate-fade-in-up space-y-6">
      <PageHeader title="Clients" description={`${clients.length} leads in your CRM pipeline.`}>
        <Link to="/clients/new"><Button><Plus className="h-4 w-4" /> Add Client</Button></Link>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name or email..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {leadStatusOrder.map((s) => <SelectItem key={s} value={s}>{leadStatusConfig[s].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex rounded-lg border border-border p-0.5">
          <button onClick={() => setView("list")} className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>List</button>
          <button onClick={() => setView("pipeline")} className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === "pipeline" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Pipeline</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No clients found" description="Try adjusting your filters or add a new client." action={<Link to="/clients/new"><Button><Plus className="h-4 w-4" /> Add Client</Button></Link>} />
      ) : view === "list" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link key={c.id} to={`/clients/${c.id}`}>
              <Card className="p-5 transition-all hover:shadow-lg">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">
                    {initials(`${c.firstName} ${c.lastName}`)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.firstName} {c.lastName}</p>
                    <Badge variant={leadStatusConfig[c.status].badge} className="mt-1">{leadStatusConfig[c.status].label}</Badge>
                  </div>
                </div>
                <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {c.email}</p>
                  <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {c.phone}</p>
                  <p className="flex items-center gap-2"><DollarSign className="h-3.5 w-3.5" /> Budget: {formatCurrency(c.budget)}</p>
                </div>
                <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">Updated {formatRelative(c.updatedAt)}</p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-6 overflow-x-auto scrollbar-thin">
          {leadStatusOrder.map((status) => {
            const colClients = filtered.filter((c) => c.status === status);
            return (
              <div key={status} className="min-w-[200px]">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold">{leadStatusConfig[status].label}</span>
                  <Badge variant="muted">{colClients.length}</Badge>
                </div>
                <div className="space-y-2">
                  {colClients.map((c) => (
                    <Link key={c.id} to={`/clients/${c.id}`}>
                      <Card className="p-3 transition-all hover:shadow-md">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold">
                            {initials(`${c.firstName} ${c.lastName}`)}
                          </div>
                          <p className="truncate text-sm font-medium">{c.firstName} {c.lastName}</p>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{formatCurrency(c.budget)}</p>
                      </Card>
                    </Link>
                  ))}
                  {colClients.length === 0 && <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
