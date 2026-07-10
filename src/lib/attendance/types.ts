export type AttendanceRow = {
  name: string; // normalized display name
  rawName: string;
  joinTime: Date;
  leaveTime: Date;
};

export type SessionData = {
  id: string;
  label: string; // e.g. "Session 1" or custom
  topic: string;
  date: string; // ISO date (yyyy-mm-dd) of the session start
  startTime: string; // ISO datetime
  endTime: string; // ISO datetime
  hostName?: string;
  hostEmail?: string;
  attendees: AttendanceRow[];
  sourceFilename: string;
};

export type StoredSession = Omit<SessionData, "attendees"> & {
  attendees: Array<{
    name: string;
    rawName: string;
    joinTime: string; // ISO
    leaveTime: string; // ISO
  }>;
};

export type Report = {
  id: string;
  name: string;
  category: Category;
  hiddenNames: string[];
  createdAt: string;
  updatedAt: string;
  sessions: StoredSession[];
};

export type Category = "MBA" | "PDBA" | "MMM";
export const CATEGORIES: Category[] = ["MBA", "PDBA", "MMM"];

export type StudentRow = {
  name: string;
  perSession: Array<{
    sessionId: string;
    join: Date | null;
    leave: Date | null;
  }>;
  attended: number;
  attendancePct: number;
};
