export const users = [
  {
    id: 1,
    email: "student@uh.edu",
    password: "student123",
    role: "user",
  },
  {
    id: 2,
    email: "admin@uh.edu",
    password: "admin123",
    role: "administrator",
  },
];

export const notifications = [
  {
    id: 1,
    userEmail: "student@uh.edu",
    entryId: 5,
    type: "status",
    message: "You are almost up for Wi-Fi / Network Help.",
    read: false,
    createdAt: "2026-10-02T09:05:00.000Z",
  },
  {
    id: 2,
    userEmail: "student@uh.edu",
    entryId: null,
    type: "queue",
    message: "Hardware Repair is closed today.",
    read: true,
    createdAt: "2026-10-02T08:00:00.000Z",
  },
];

export const services = [
  {
    id: 1,
    name: "Password Reset",
    description: "Reset or unlock your university account.",
    expectedDuration: 10,
    priority: "high",
    isOpen: true,
  },
  {
    id: 2,
    name: "Wi-Fi / Network Help",
    description: "Trouble connecting to campus Wi-Fi or the VPN.",
    expectedDuration: 10,
    priority: "high",
    isOpen: true,
  },
  {
    id: 3,
    name: "Software Install Request",
    description: "Request or troubleshoot licensed software.",
    expectedDuration: 10,
    priority: "high",
    isOpen: true,
  },
  {
    id: 4,
    name: "Hardware Repair",
    description: "Laptop, printer, and lab computer issues.",
    expectedDuration: 10,
    priority: "high",
    isOpen: false,
  },
];

export const queueEntries = [
  { id: 1, ticketNumber: "Q-1040", serviceId: 1, userEmail: "student2@example.com", status: "waiting", priority: "high", joinedAt: "2026-10-02T09:00:00.000Z", finishedAt: null },
  { id: 2, ticketNumber: "Q-1041", serviceId: 1, userEmail: "faculty1@example.com", status: "waiting", priority: "high", joinedAt: "2026-10-02T09:04:00.000Z", finishedAt: null },
  { id: 3, ticketNumber: "Q-1042", serviceId: 1, userEmail: "student@uh.edu", status: "waiting", priority: "high", joinedAt: "2026-10-02T09:08:00.000Z", finishedAt: null },
  { id: 4, ticketNumber: "Q-1043", serviceId: 1, userEmail: "student3@example.com", status: "waiting", priority: "high", joinedAt: "2026-10-02T09:12:00.000Z", finishedAt: null },
  { id: 5, ticketNumber: "Q-2010", serviceId: 2, userEmail: "student@uh.edu", status: "waiting", priority: "high", joinedAt: "2026-10-02T08:50:00.000Z", finishedAt: null },
  { id: 6, ticketNumber: "Q-2011", serviceId: 2, userEmail: "student4@example.com", status: "waiting", priority: "high", joinedAt: "2026-10-02T08:55:00.000Z", finishedAt: null },
  { id: 7, ticketNumber: "Q-3001", serviceId: 3, userEmail: "student5@example.com", status: "waiting", priority: "high", joinedAt: "2026-10-02T08:40:00.000Z", finishedAt: null },
  { id: 8, ticketNumber: "Q-3000", serviceId: 3, userEmail: "student@uh.edu", status: "served", priority: "high", joinedAt: "2026-09-20T10:00:00.000Z", finishedAt: "2026-09-20T10:25:00.000Z" },
  { id: 9, ticketNumber: "Q-1039", serviceId: 1, userEmail: "student@uh.edu", status: "canceled", priority: "high", joinedAt: "2026-09-22T14:00:00.000Z", finishedAt: "2026-09-22T14:06:00.000Z" },
];
