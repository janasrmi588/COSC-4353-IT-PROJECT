export const STATUSES = ['waiting', 'almost ready', 'served', 'canceled'];
export const PRIORITIES = ['low', 'medium', 'high'];

export const mockCurrentUser = { email: 'student1@example.com', role: 'user' };

export const services = [
  { id: 1, name: 'Password Reset', description: 'Reset or unlock your university account.', expectedDuration: 10, priority: 'high', isOpen: true },
  { id: 2, name: 'Wi-Fi / Network Help', description: 'Trouble connecting to campus Wi-Fi or the VPN.', expectedDuration: 10, priority: 'high', isOpen: true },
  { id: 3, name: 'Software Install Request', description: 'Request or troubleshoot licensed software.', expectedDuration: 10, priority: 'high', isOpen: true },
  { id: 4, name: 'Hardware Repair', description: 'Laptop, printer, and lab computer issues.', expectedDuration: 10, priority: 'high', isOpen: false },
];

export const queueEntries = [
  { id: 1, ticketNumber: 'Q-1040', serviceId: 1, userEmail: 'student2@example.com', status: 'waiting', joinedAt: '2026-10-02T09:00:00', finishedAt: null },
  { id: 2, ticketNumber: 'Q-1041', serviceId: 1, userEmail: 'faculty1@example.com', status: 'waiting', joinedAt: '2026-10-02T09:04:00', finishedAt: null },
  { id: 3, ticketNumber: 'Q-1042', serviceId: 1, userEmail: 'student1@example.com', status: 'waiting', joinedAt: '2026-10-02T09:08:00', finishedAt: null },
  { id: 4, ticketNumber: 'Q-1043', serviceId: 1, userEmail: 'student3@example.com', status: 'waiting', joinedAt: '2026-10-02T09:12:00', finishedAt: null },
  { id: 5, ticketNumber: 'Q-2010', serviceId: 2, userEmail: 'student1@example.com', status: 'waiting', joinedAt: '2026-10-02T08:50:00', finishedAt: null },
  { id: 6, ticketNumber: 'Q-2011', serviceId: 2, userEmail: 'student4@example.com', status: 'waiting', joinedAt: '2026-10-02T08:55:00', finishedAt: null },
  { id: 7, ticketNumber: 'Q-0901', serviceId: 3, userEmail: 'student1@example.com', status: 'served', joinedAt: '2026-09-20T10:00:00', finishedAt: '2026-09-20T10:25:00' },
  { id: 8, ticketNumber: 'Q-0955', serviceId: 1, userEmail: 'student1@example.com', status: 'canceled', joinedAt: '2026-09-22T14:00:00', finishedAt: '2026-09-22T14:06:00' },
  { id: 9, ticketNumber: "Q-3001", serviceId: 3, userEmail: "student5@example.com", status: "waiting", joinedAt: "2026-10-02T08:40:00", finishedAt: null },
];

export const statusUpdates = [
  { id: 1, entryId: 3, status: 'waiting', message: 'You joined the Password Reset queue.', timestamp: '2026-10-02T09:08:00' },
  { id: 2, entryId: 5, status: 'waiting', message: 'You joined the Wi-Fi / Network Help queue.', timestamp: '2026-10-02T08:50:00' },
  { id: 3, entryId: 5, status: 'almost ready', message: 'You are almost up. Please be ready.', timestamp: '2026-10-02T09:05:00' },
];

export const notifications = [
  { id: 1, userEmail: 'student1@example.com', entryId: 5, type: 'status', message: 'You are almost up for Wi-Fi / Network Help.', read: false, createdAt: '2026-10-02T09:05:00' },
  { id: 2, userEmail: 'student1@example.com', entryId: null, type: 'queue', message: 'Hardware Repair is closed today.', read: true, createdAt: '2026-10-02T08:00:00' },
];
