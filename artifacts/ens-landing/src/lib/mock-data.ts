import { 
  Users, 
  Briefcase, 
  UserSquare2, 
  AlertCircle, 
  Clock, 
  Monitor, 
  FileText, 
  MessageSquare, 
  CheckCircle2, 
  Layout, 
  Package, 
  Settings,
  TrendingUp,
  BarChart3
} from "lucide-react";

export const mockStats = {
  chief: [
    { label: "Total Clients", value: "124", icon: Users, trend: "+12%", trendUp: true },
    { label: "Active Projects", value: "48", icon: Briefcase, trend: "+5%", trendUp: true },
    { label: "Managers", value: "12", icon: UserSquare2, trend: "0%", trendUp: true },
    { label: "Delayed Projects", value: "3", icon: AlertCircle, trend: "-2%", trendUp: false },
    { label: "Pending Assignments", value: "7", icon: Clock, trend: "+2", trendUp: true },
    { label: "Active Workspaces", value: "24", icon: Monitor, trend: "+8%", trendUp: true },
  ],
  pm: [
    { label: "My Clients", value: "8", icon: Users, trend: "+1", trendUp: true },
    { label: "Active Projects", value: "12", icon: Briefcase, trend: "+2", trendUp: true },
    { label: "Pending Reviews", value: "4", icon: Clock, trend: "-1", trendUp: false },
    { label: "Completed", value: "45", icon: CheckCircle2, trend: "+4", trendUp: true },
    { label: "Messages", value: "18", icon: MessageSquare, trend: "+6", trendUp: true },
  ],
  client: [
    { label: "Project Progress", value: "65%", icon: TrendingUp, trend: "On Track", trendUp: true },
    { label: "Pending Approvals", value: "2", icon: CheckCircle2, trend: "-1", trendUp: false },
    { label: "Total Revisions", value: "4", icon: Layout, trend: "Avg 2/mo", trendUp: true },
    { label: "Documents", value: "12", icon: FileText, trend: "+2 new", trendUp: true },
  ]
};

export const mockProjects = [
  {
    id: "p1",
    name: "TechCon 2024 - Global Exhibit",
    client: "TechCorp Industries",
    pm: "John Doe",
    status: "Active",
    progress: 75,
    deadline: "2024-08-15",
    system: "Maxima",
    dimensions: "10x10m",
    lastUpdate: "2 hours ago",
    exhibition: "TechCon 2024",
    standType: "Maxima",
    description: "Premium double-story stand with integrated LED walls.",
    revisions: [
      { id: "r1", date: "2024-05-10", note: "Initial design submitted", status: "Approved" },
      { id: "r2", date: "2024-05-15", note: "Adjusted lighting placement", status: "Approved" },
      { id: "r3", date: "2024-05-20", note: "Added client branding", status: "Pending" },
    ],
    approvals: [
      { id: "a1", title: "Booth Layout", description: "Overall spatial arrangement and flow", status: "Approved", date: "2024-05-12" },
      { id: "a2", title: "Branding Placement", description: "Logo positioning and sizing on all surfaces", status: "Pending", date: "-" },
      { id: "a3", title: "Final Design", description: "Final 3D render and material selection", status: "Pending", date: "-" },
    ]
  },
  {
    id: "p2",
    name: "HealthExpo Booth",
    client: "MediLife",
    pm: "Jane Smith",
    status: "Delayed",
    progress: 40,
    deadline: "2024-07-20",
    system: "Octanorm",
    dimensions: "6x3m",
    lastUpdate: "1 day ago",
    exhibition: "HealthExpo",
    standType: "Octanorm",
    description: "Standard modular booth with custom graphics.",
    revisions: [],
    approvals: []
  },
  {
    id: "p3",
    name: "AutoShow Premium Stand",
    client: "FastCars Co",
    pm: "Mike Ross",
    status: "Pending",
    progress: 10,
    deadline: "2024-09-01",
    system: "Maxima",
    dimensions: "12x8m",
    lastUpdate: "3 days ago",
    exhibition: "AutoShow",
    standType: "Maxima",
    description: "High-end car display stand with rotating platform.",
    revisions: [],
    approvals: []
  }
];

export const mockMessages = [
  { id: 1, sender: "John Doe", role: "Project Manager", text: "Hi! I've updated the lighting in the 3D workspace. Could you please take a look?", time: "2 hours ago", avatar: "" },
  { id: 2, sender: "You", role: "Client", text: "Thanks John. It looks much better. I still have some concerns about the branding on the left wall.", time: "1 hour ago", avatar: "" },
  { id: 3, sender: "John Doe", role: "Project Manager", text: "I understand. I'll make the branding larger and more prominent. Will update you shortly.", time: "30 mins ago", avatar: "" },
];

export const mockDocuments = [
  { id: 1, name: "Final_Layout_v2.pdf", type: "PDF", date: "2024-05-15", size: "2.4 MB" },
  { id: 2, name: "Branding_Guidelines.pdf", type: "PDF", date: "2024-05-10", size: "1.1 MB" },
  { id: 3, name: "Booth_Render_Perspective.jpg", type: "Image", date: "2024-05-16", size: "4.8 MB" },
  { id: 4, name: "Quote_0422.pdf", type: "PDF", date: "2024-05-08", size: "156 KB" },
];

export const mockClients = [
  { id: "c1", name: "TechCorp Industries", exhibition: "TechCon 2024", pm: "John Doe", status: "Active", lastActivity: "2 hours ago" },
  { id: "c2", name: "MediLife", exhibition: "HealthExpo", pm: "Jane Smith", status: "Active", lastActivity: "5 hours ago" },
  { id: "c3", name: "FastCars Co", exhibition: "AutoShow", pm: "Mike Ross", status: "Pending", lastActivity: "1 day ago" },
];

export const mockManagers = [
  { id: "m1", name: "John Doe", role: "Project Manager", workload: 85, projects: 12, rating: 4.8, status: "Active" },
  { id: "m2", name: "Jane Smith", role: "Project Manager", workload: 60, projects: 8, rating: 4.9, status: "Active" },
  { id: "m3", name: "Mike Ross", role: "Project Manager", workload: 40, projects: 5, rating: 4.5, status: "On Leave" },
];

export const mockActivity = [
  { id: 1, type: "update", user: "John Doe", action: "updated workspace", project: "TechCon 2024", time: "10 mins ago" },
  { id: 2, type: "message", user: "Client (MediLife)", action: "sent a message", project: "HealthExpo", time: "1 hour ago" },
  { id: 3, type: "approval", user: "System", action: "automatically flagged delay", project: "AutoShow", time: "3 hours ago" },
];

export const chartData = {
  activity: [
    { day: "Mon", projects: 40 },
    { day: "Tue", projects: 45 },
    { day: "Wed", projects: 38 },
    { day: "Thu", projects: 52 },
    { day: "Fri", projects: 61 },
    { day: "Sat", projects: 48 },
    { day: "Sun", projects: 55 },
  ],
  distribution: [
    { name: "Active", value: 45, color: "#3b82f6" },
    { name: "Pending", value: 25, color: "#eab308" },
    { name: "Delayed", value: 10, color: "#ef4444" },
    { name: "Completed", value: 20, color: "#22c55e" },
  ]
};
