import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { StatusBadge } from "@/components/StatusBadge";
import {
  FileText,
  TrendingUp,
  Clock,
  XCircle,
  CheckCircle2,
  Users,
  Eye,
  Filter,
  X,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useDashboardData } from "@/lib/useDashboardData";
import { LeadViewModal } from "@/components/LeadViewModal";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";

export default function Dashboard() {
  const {
    loading,
    kpiData,
    leadsByStatus,
    leadsByAgent,
    recentLeads,
  } = useDashboardData();

  const [viewLead, setViewLead] = useState<any | null>(null);

  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedRange, setSelectedRange] = useState<number | "custom">(7);
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a855f7', '#16a34a'];

  const clearAllFilters = () => {
    setSelectedAgents([]);
    setSelectedStatuses([]);
    setSelectedRange(7);
    setCustomFrom(null);
    setCustomTo(null);
  };

  // Check if any filters are active
  const hasActiveFilters = 
    selectedAgents.length > 0 || 
    selectedStatuses.length > 0 || 
    selectedRange !== 7 || 
    customFrom !== null || 
    customTo !== null;

  const filteredLeads = useMemo(() => {
    let filtered = recentLeads;

    // Date filter
    if (selectedRange === "custom") {
      if (customFrom && customTo) {
        const fromDate = new Date(customFrom);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = new Date(customTo);
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter((lead) => {
          if (!lead._createdAt) return false;
          const createdAt = new Date(lead._createdAt);
          return createdAt >= fromDate && createdAt <= toDate;
        });
      }
    } else {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - selectedRange);
      filtered = filtered.filter((lead) => {
        if (!lead._createdAt) return false;
        return new Date(lead._createdAt) >= daysAgo;
      });
    }

    // Agent filter
    if (selectedAgents.length > 0) {
      filtered = filtered.filter((lead) => selectedAgents.includes(lead.assignedToName));
    }

    // Status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((lead) => selectedStatuses.includes(lead.status));
    }

    return filtered;
  }, [recentLeads, selectedRange, customFrom, customTo, selectedAgents, selectedStatuses]);

  return (
    <DashboardLayout title="Dashboard">
      {/* FILTER TOOLBAR */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        {hasActiveFilters && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-red-500 hover:bg-red-50 hover:text-red-600"
            onClick={clearAllFilters}
          >
            <X className="h-4 w-4 mr-1" />
            Clear All Filters
          </Button>
        )}
        {/* Date Range Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <Filter className="h-4 w-4" />
              Date Range
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48">
            <DropdownMenuCheckboxItem
              checked={selectedRange === 7}
              onCheckedChange={() => setSelectedRange(7)}
            >
              Last 7 days
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={selectedRange === 15}
              onCheckedChange={() => setSelectedRange(15)}
            >
              Last 15 days
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={selectedRange === 30}
              onCheckedChange={() => setSelectedRange(30)}
            >
              Last 30 days
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={selectedRange === "custom"}
              onCheckedChange={() => setSelectedRange("custom")}
            >
              Custom Range
            </DropdownMenuCheckboxItem>
            {selectedRange === "custom" && (
              <div className="p-2 space-y-2">
                <label className="block text-sm font-medium">From:</label>
                <input
                  type="date"
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={customFrom ? customFrom.toISOString().substring(0, 10) : ""}
                  onChange={(e) => setCustomFrom(e.target.value ? new Date(e.target.value) : null)}
                />
                <label className="block text-sm font-medium">To:</label>
                <input
                  type="date"
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={customTo ? customTo.toISOString().substring(0, 10) : ""}
                  onChange={(e) => setCustomTo(e.target.value ? new Date(e.target.value) : null)}
                />
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Agent Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <Filter className="h-4 w-4" />
              Agent
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48 max-h-60 overflow-auto">
            {leadsByAgent.map(({ agent }) => (
              <DropdownMenuCheckboxItem
                key={agent}
                checked={selectedAgents.includes(agent)}
                onCheckedChange={() => {
                  if (selectedAgents.includes(agent)) {
                    setSelectedAgents(selectedAgents.filter((a) => a !== agent));
                  } else {
                    setSelectedAgents([...selectedAgents, agent]);
                  }
                }}
              >
                {agent}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Status Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <Filter className="h-4 w-4" />
              Status
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48 max-h-60 overflow-auto">
            {leadsByStatus.map(({ status }) => (
              <DropdownMenuCheckboxItem
                key={status}
                checked={selectedStatuses.includes(status)}
                onCheckedChange={() => {
                  if (selectedStatuses.includes(status)) {
                    setSelectedStatuses(selectedStatuses.filter((s) => s !== status));
                  } else {
                    setSelectedStatuses([...selectedStatuses, status]);
                  }
                }}
              >
                {status}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* KPI GRID */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
        <KPICard title="Total Leads" value={kpiData.totalLeads} icon={FileText} />
        <KPICard title="New Leads (7d)" value={kpiData.newLeads7Days} icon={TrendingUp} />
        <KPICard title="Follow-Ups Today" value={kpiData.followUpsToday} icon={Clock} />
        <KPICard title="Overdue Follow-Ups" value={kpiData.overdueFollowUps} icon={XCircle} />
        <KPICard title="Closed Deals" value={kpiData.closedDeals} icon={CheckCircle2} />
        <KPICard title="Active Agents" value={kpiData.activeAgents} icon={Users} />
      </div>

      {/* CHARTS */}
      <div className="grid gap-6 mt-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Leads by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={leadsByStatus}>
                <XAxis
                  dataKey="status"
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={70}
                />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leads by Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={leadsByAgent}
                  dataKey="leads"
                  nameKey="agent"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  label
                >
                  {leadsByAgent.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* RECENT LEADS */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent Leads</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Date</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.slice(0, 10).map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <div className="font-medium">{l.name}</div>
                    <div className="text-xs text-muted-foreground">{l.phone}</div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={l.status} />
                  </TableCell>
                  <TableCell>{l.assignedToName}</TableCell>
                  <TableCell>
                    {l._createdAt?.toLocaleDateString("en-IN")}
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => setViewLead(l)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <LeadViewModal
        lead={viewLead}
        open={!!viewLead}
        onOpenChange={(o) => !o && setViewLead(null)}
      />
    </DashboardLayout>
  );
}