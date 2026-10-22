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
