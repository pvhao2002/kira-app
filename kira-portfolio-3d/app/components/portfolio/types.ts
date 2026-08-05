export const ROOM_IDS = ['projects', 'experience', 'about', 'contact'] as const;

export type RoomId = (typeof ROOM_IDS)[number];

export type Project = {
  title: string;
  description: string;
  stack: string[];
  href: string;
};

export type RoomContent = {
  id: RoomId;
  label: string;
  summary: string;
  world: string;
};
