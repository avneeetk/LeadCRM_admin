export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  source: string;
  budget: string;
  status: "new" | "contacted" | "follow-up" | "closed" | "lost" | "hot";
  assignedTo: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  assignedLeads: number;
  closedDeals: number;
  active: boolean;
  punchedIn?: boolean;
  punchInTime?: string;
  punchOutTime?: string;
}

export interface AttendanceRecord {
  userId: string;
  name: string;
  date: string;
  punchIn?: string;
  punchOut?: string;
  duration?: string;
  officeIp?: string;
  status: "present" | "absent" | "on-break";
}

export const mockLeads: Lead[] = [
  {
    id: "1",
    name: "John Smith",
    phone: "+1 234-567-8901",
    email: "john.smith@email.com",
    source: "Website",
    budget: "$500k - $750k",
    status: "hot",
    assignedTo: "Sarah Johnson",
    createdAt: "2025-10-20",
  },
  {
    id: "2",
    name: "Emily Davis",
    phone: "+1 234-567-8902",
    email: "emily.davis@email.com",
    source: "Referral",
    budget: "$300k - $450k",
    status: "follow-up",
    assignedTo: "Mike Chen",
    createdAt: "2025-10-19",
  },
  {
    id: "3",
    name: "Robert Wilson",
    phone: "+1 234-567-8903",
    email: "robert.wilson@email.com",
    source: "Social Media",
    budget: "$750k - $1M",
    status: "new",
    assignedTo: "Sarah Johnson",
    createdAt: "2025-10-18",
  },
  {
    id: "4",
    name: "Lisa Anderson",
    phone: "+1 234-567-8904",
    email: "lisa.anderson@email.com",
    source: "Walk-in",
    budget: "$400k - $600k",
    status: "contacted",
    assignedTo: "David Lee",
    createdAt: "2025-10-17",
  },
  {
    id: "5",
    name: "Michael Brown",
    phone: "+1 234-567-8905",
    email: "michael.brown@email.com",
    source: "Website",
    budget: "$1M+",
    status: "closed",
    assignedTo: "Sarah Johnson",
    createdAt: "2025-10-15",
  },
  {
    id: "6",
    name: "Jennifer Taylor",
    phone: "+1 234-567-8906",
    email: "jennifer.taylor@email.com",
    source: "Phone Call",
    budget: "$250k - $350k",
    status: "lost",
    assignedTo: "Mike Chen",
    createdAt: "2025-10-14",
  },
];

export const mockAgents: Agent[] = [
  {
    id: "1",
    name: "Sarah Johnson",
    email: "sarah.j@realestate.com",
    phone: "+1 234-567-8910",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
    assignedLeads: 45,
    closedDeals: 12,
    active: true,
    punchedIn: true,
    punchInTime: "09:00 AM",
  },
  {
    id: "2",
    name: "Mike Chen",
    email: "mike.c@realestate.com",
    phone: "+1 234-567-8911",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=mike",
    assignedLeads: 38,
    closedDeals: 10,
    active: true,
    punchedIn: true,
    punchInTime: "08:45 AM",
  },
  {
    id: "3",
    name: "David Lee",
    email: "david.l@realestate.com",
    phone: "+1 234-567-8912",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=david",
    assignedLeads: 32,
    closedDeals: 8,
    active: true,
    punchedIn: true,
    punchInTime: "09:15 AM",
    punchOutTime: "06:00 PM",
  },
  {
    id: "4",
    name: "Rachel Martinez",
    email: "rachel.m@realestate.com",
    phone: "+1 234-567-8913",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=rachel",
    assignedLeads: 28,
    closedDeals: 7,
    active: true,
    punchedIn: false,
  },
];

export const getKPIData = () => ({
  totalLeads: 12430,
  activeLeads: 2100,
  closedDeals: 760,
  lostLeads: 560,
  activeAgents: 8,
  employeesPresent: 3,
  conversionRate: 19.1,
  qualifiedLeads: 420,
  followUpRate: 78.5,
  avgTimeToConversion: 12.3,
});

export const getLeadsByStatus = () => [
  { status: "New", count: 450, fill: "hsl(var(--info))" },
  { status: "Contacted", count: 680, fill: "hsl(var(--secondary))" },
  { status: "Follow-Up", count: 970, fill: "hsl(var(--warning))" },
  { status: "Closed", count: 760, fill: "hsl(var(--success))" },
];

export const getLeadsByAgent = () => [
  { agent: "Sarah J.", leads: 45, fill: "#2563EB" },
  { agent: "Mike C.", leads: 38, fill: "#7C3AED" },
  { agent: "David L.", leads: 32, fill: "#DC2626" },
  { agent: "Rachel M.", leads: 28, fill: "#EAB308" },
  { agent: "Others", leads: 67, fill: "#6B7280" },
];

export const getLeadsBySource = () => [
  { source: "Website", count: 3200, conversions: 620, fill: "hsl(var(--primary))" },
  { source: "Referral", count: 2800, conversions: 580, fill: "hsl(var(--success))" },
  { source: "Social Media", count: 2100, conversions: 380, fill: "hsl(var(--info))" },
  { source: "Walk-in", count: 1850, conversions: 340, fill: "hsl(var(--warning))" },
  { source: "Phone Call", count: 1680, conversions: 290, fill: "hsl(var(--secondary))" },
  { source: "Ad Campaign", count: 800, conversions: 150, fill: "hsl(var(--destructive))" },
];

export const getTodayAttendance = (): AttendanceRecord[] => [
  {
    userId: "1",
    name: "Sarah Johnson",
    date: new Date().toISOString().split('T')[0],
    punchIn: "09:00 AM",
    status: "present",
    officeIp: "192.168.1.10",
  },
  {
    userId: "2",
    name: "Mike Chen",
    date: new Date().toISOString().split('T')[0],
    punchIn: "08:45 AM",
    status: "present",
    officeIp: "192.168.1.11",
  },
  {
    userId: "3",
    name: "David Lee",
    date: new Date().toISOString().split('T')[0],
    punchIn: "09:15 AM",
    punchOut: "06:00 PM",
    duration: "8h 45m",
    status: "present",
    officeIp: "192.168.1.12",
  },
  {
    userId: "4",
    name: "Rachel Martinez",
    date: new Date().toISOString().split('T')[0],
    status: "absent",
  },
];
