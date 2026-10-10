import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Building2, Users, CalendarDays, DollarSign, TrendingUp, TrendingDown,
  Plus, ArrowRight, Eye, Home, Award, Activity, Target,
  Clock, CheckCircle2, XCircle, Phone, Mail,
} from "lucide-react";
import { useDataStore } from "@/stores/data-store";
import { useAuthStore } from "@/stores/auth-store";
import { StatCard } from "@/components/shared/stat-card";
import { StatCardSkeleton, ChartSkeleton } from "@/components/shared/skeletons";
import { PageHeader } from "@/components/shared/states";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { propertyStatusConfig, leadStatusConfig, appointmentStatusConfig } from "@/lib/constants";
import { formatCurrency, formatCompactCurrency, formatRelative, initials } from "@/lib/utils";
import { mockRecentActivity, mockUsers } from "@/lib/mock-data";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from "recharts";

const CHART_COLORS = ["hsl(152 43% 50%)", "hsl(38 92% 50%)", "hsl(199 89% 48%)", "hsl(0 84% 60%)", "hsl(220 9% 56%)"];

const monthlyData = [
  { month: "Apr", revenue: 120000, deals: 3 },
  { month: "May", revenue: 185000, deals: 5 },
  { month: "Jun", revenue: 95000, deals: 2 },
  { month: "Jul", revenue: 210000, deals: 6 },
  { month: "Aug", revenue: 165000, deals: 4 },
  { month: "Sep", revenue: 545000, deals: 8 },
];

const agentPerformance = [
  { name: "James Carter", deals: 8, revenue: 545000, listings: 8, avatar: "JC", rating: 4.9 },
  { name: "Sarah Mitchell", deals: 6, revenue: 420000, listings: 5, avatar: "SM", rating: 5.0 },
  { name: "Emily Rodriguez", deals: 3, revenue: 185000, listings: 3, avatar: "ER", rating: 4.7 },
];

const leadConversionData = [
  { stage: "New", count: 1, color: "hsl(199 89% 48%)" },
  { stage: "Contacted", count: 1, color: "hsl(38 92% 50%)" },
  { stage: "Viewing", count: 1, color: "hsl(280 60% 55%)" },
  { stage: "Negotiation", count: 1, color: "hsl(220 9% 56%)" },
  { stage: "Closed", count: 1, color: "hsl(152 43% 50%)" },
];

const activityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  property: Building2, client: Users, appointment: CalendarDays, document: Clock, deal: DollarSign,
};

export default function DashboardPage() {
  const { properties, clients, appointments } = useDataStore();
  const user = useAuthStore((s) => s.user);
  const [loading] = useState(false);

  const activeListings = properties.filter((p) => p.status === "available" || p.status === "under_offer").length;
  const activeDeals = clients.filter((c) => c.status === "negotiation" || c.status === "viewing").length;
  const upcomingAppts = appointments.filter((a) => a.status === "scheduled").length;
  const totalRevenue = properties.filter((p) => p.status === "sold" || p.status === "rented").reduce((sum, p) => sum + p.price, 0);
  const totalViews = properties.reduce((sum, p) => sum + p.views, 0);
  const conversionRate = clients.length > 0 ? Math.round((clients.filter((c) => c.status === "closed").length / clients.length) * 100) : 0;

  const statusData = useMemo(() => Object.entries(
    properties.reduce<Record<string, number>>((acc, p) => {
      const label = propertyStatusConfig[p.status].label;
      acc[label] = (acc[label] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, count]) => ({ name, value: count })), [properties]);

  const leadData = useMemo(() => Object.entries(
    clients.reduce<Record<string, number>>((acc, c) => {
      const label = leadStatusConfig[c.status].label;
      acc[label] = (acc[label] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, count]) => ({ name, value: count })), [clients]);

  const upcomingAppointments = appointments
    .filter((a) => a.status === "scheduled")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const recentProperties = [...properties].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2"><ChartSkeleton /></div>
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      <PageHeader title={`Welcome back, ${user?.firstName}`} description="Here's what's happening with your agency today.">
        <Link to="/properties/new"><Button><Plus className="h-4 w-4" /> New Listing</Button></Link>
      </PageHeader>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Listings" value={activeListings} icon={Building2} trend="12% from last month" trendUp />
        <StatCard label="Active Deals" value={activeDeals} icon={Users} trend="3 in negotiation" trendUp />
        <StatCard label="Upcoming Viewings" value={upcomingAppts} icon={CalendarDays} trend="This week" trendUp />
        <StatCard label="Total Revenue" value={formatCompactCurrency(totalRevenue)} icon={DollarSign} trend="8% from last quarter" trendUp />
      </div>

      {/* Secondary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Property Views" value={totalViews.toLocaleString()} icon={Eye} trend="15% increase" trendUp />
        <StatCard label="Conversion Rate" value={`${conversionRate}%`} icon={Target} trend="Above industry avg" trendUp />
        <StatCard label="Avg. Property Value" value={formatCompactCurrency(Math.round(properties.reduce((s, p) => s + p.price, 0) / properties.length))} icon={Home} trend="5% YoY" trendUp />
        <StatCard label="Client Satisfaction" value="98%" icon={Award} trend="Based on surveys" trendUp />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Revenue & Deals Overview</CardTitle>
            <Badge variant="success"><TrendingUp className="h-3 w-3" /> Growing</Badge>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(152 43% 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(152 43% 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}K`} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} formatter={(v: number) => [formatCurrency(v), "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(152 43% 50%)" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Listings by Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                  {statusData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1.5">
              {statusData.map((s, i) => (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-muted-foreground">{s.name}</span>
                  </div>
                  <span className="font-medium">{s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent performance + Lead pipeline */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Agent Performance</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {agentPerformance.map((agent, i) => (
              <div key={agent.name} className="flex items-center gap-4 rounded-lg border border-border p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">
                  {agent.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-medium">{agent.name}</p>
                    <div className="flex items-center gap-1 text-xs">
                      <Award className="h-3 w-3 text-warning" />
                      <span className="font-medium">{agent.rating}</span>
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{agent.deals} deals closed</span>
                    <span>{agent.listings} active listings</span>
                    <span className="font-medium text-foreground">{formatCompactCurrency(agent.revenue)}</span>
                  </div>
                </div>
                {i === 0 && <Badge variant="success" className="shrink-0">Top Agent</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Lead Pipeline</CardTitle>
            <Link to="/clients"><Button variant="ghost" size="sm">View all <ArrowRight className="h-3 w-3" /></Button></Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {leadData.map((l) => (
              <div key={l.name} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-sm font-medium">{l.name}</span>
                <Badge variant="muted">{l.value}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity + Upcoming appointments */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" /> Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockRecentActivity.slice(0, 5).map((act) => {
              const Icon = activityIcons[act.type] ?? Clock;
              return (
                <div key={act.id} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{act.description}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{act.actorName} · {formatRelative(act.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Upcoming Appointments</CardTitle>
            <Link to="/appointments"><Button variant="ghost" size="sm">View all <ArrowRight className="h-3 w-3" /></Button></Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingAppointments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No upcoming appointments.</p>
            ) : (
              upcomingAppointments.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <img src={a.propertyImage} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.propertyTitle}</p>
                    <p className="text-xs text-muted-foreground">{a.clientName} · {a.date} at {a.time}</p>
                  </div>
                  <Badge variant={appointmentStatusConfig[a.status].badge}>{appointmentStatusConfig[a.status].label}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent properties */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Recent Listings</CardTitle>
          <Link to="/properties"><Button variant="ghost" size="sm">View all <ArrowRight className="h-3 w-3" /></Button></Link>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recentProperties.map((p) => (
              <Link key={p.id} to={`/properties/${p.id}`} className="group overflow-hidden rounded-lg border border-border transition-shadow hover:shadow-md">
                <div className="relative h-32 overflow-hidden">
                  <img src={p.images[0]} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  <Badge variant={propertyStatusConfig[p.status].badge} className="absolute left-2 top-2">
                    {propertyStatusConfig[p.status].label}
                  </Badge>
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium">{p.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{p.location}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-display text-sm font-bold text-primary">{formatCompactCurrency(p.price)}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="h-3 w-3" /> {p.views}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
