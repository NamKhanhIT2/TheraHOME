// Shape definitions shared between src/lib/db.ts (real Supabase queries)
// and the Admin/CSKH view components. Originally ported from
// .design-reference/data.js as click-through mock data; the mock arrays
// themselves were removed once every view moved to real data (see
// CLAUDE.md) — only the shapes remain, now populated from Supabase.

export interface ProgramPhase {
  id: string;
  name: string;
  range: [number, number];
}

// Per-market content — VN/UK/ML (the app's own AdminMarket codes are
// VN/US/MALAY; "UK"/"ML" here is only display copy, see CLAUDE.md).
export interface MarketContent {
  vn: string;
  us: string;
  malay: string;
}

export interface ProgramDay {
  id: number;
  phase: string;
  status: "done" | "current" | "locked";
  video: MarketContent;
  supportToolsUrl: MarketContent;
  type: "train" | "rest";
}

export interface Product {
  id: string;
  name: string;
  accent: string;
  totalDays: number;
  phases: ProgramPhase[];
  days: ProgramDay[];
  painLevels: number[];
}

export interface StoreItem {
  id: string;
  name: string;
  desc: string;
  price: string;
  accent: string;
  link: string;
  previewLink: string;
  imageUrl: string;
  market: "VN" | "US" | "MALAY";
}

export interface StoreCategory {
  id: string;
  title: string;
  hasTrial: boolean;
  items: StoreItem[];
}

export interface Article {
  tag: string;
  title: string;
  readTime: string;
}

export interface CommunityComment {
  name: string;
  avatarColor?: string;
  text: string;
  time: string;
  likes?: number;
  official?: boolean;
  replies?: CommunityComment[];
  /** Real post_comments.id — present only for comments loaded from Supabase (see src/lib/db.ts), used to target deletes. */
  idKey?: string;
}

export interface CommunityPost {
  id: string | number;
  official?: boolean;
  name: string;
  avatarColor?: string;
  meta?: string;
  title?: string;
  text: string;
  likes: number;
  comments: number;
  badge?: string;
  action?: string;
  tag?: string;
  commentsList?: CommunityComment[];
}

export interface NotificationItem {
  id: number;
  type: "schedule" | "ad" | "blog";
  title: string;
  body: string;
  time: string;
  read: boolean;
  dayId?: number;
  productId?: string;
}

export interface LandingOrder {
  id: number;
  phone: string;
  email: string;
  product: string;
  status: "activated" | "pending";
  code: string;
  orderDate: string;
}
