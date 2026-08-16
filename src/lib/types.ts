export type Couple = {
  id: string;
  member_a: string;
  member_b: string | null;
  invite_code: string | null;
  created_at: string;
  paired_at: string | null;
};

export type Message = {
  id: string;
  couple_id: string;
  sender_id: string;
  kind: "text" | "image";
  body: string | null;
  storage_path: string | null;
  view_once: boolean;
  opened_at: string | null;
  expires_at: string | null;
  read_at: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  display_name: string;
  emoji: string;
};
