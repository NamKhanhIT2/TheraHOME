// Maps the prototype's icon names (icons-extra.jsx's `IconX` + the design-system
// `Icon`) onto `lucide-react-native`, since the source's inline web `<svg>` JSX
// can't run in React Native. A handful of names were renamed/removed in the
// installed lucide version (verified against node_modules) — mapped to the
// closest current equivalent, noted inline. Anything still missing falls back
// to a plain circle glyph instead of crashing.
import React from 'react';
import { Circle, Svg } from 'react-native-svg';
import {
  Accessibility,
  Activity,
  Bell,
  Bone,
  Book,
  Bookmark,
  Box,
  Brain,
  Calendar,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Clock,
  ClipboardCheck,
  Copy,
  Crown,
  Download,
  Droplet,
  Ellipsis,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Flag,
  Flame,
  Film,
  Funnel,
  Globe,
  Headphones,
  Heart,
  HeartPulse,
  House,
  Image as ImageIcon,
  Keyboard,
  Layers,
  Library,
  Link as LinkIcon,
  LayoutGrid,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Mic,
  MicOff,
  Minus,
  Moon,
  Pause,
  Pencil,
  Phone,
  PhoneOff,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ThumbsUp,
  ShoppingBag,
  Shield,
  ShieldCheck,
  Smartphone,
  SlidersHorizontal,
  Laugh,
  Sparkles,
  Square,
  SquareCheck,
  Star,
  Sun,
  Play,
  Trash2,
  TrendingUp,
  User,
  UserX,
  UserPlus,
  Users,
  UsersRound,
  Dumbbell,
  Volume2,
  VolumeX,
  WifiOff,
  X,
  Video,
  VideoOff,
  SwitchCamera,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';

const ICONS: Record<string, LucideIcon> = {
  'chevron-left': ChevronLeft,
  play: Play,
  lock: Lock,
  activity: Activity,
  bell: Bell,
  book: Book,
  sun: Sun,
  moon: Moon,
  'chevron-right': ChevronRight,
  'log-out': LogOut,
  mail: Mail,
  'shield-check': ShieldCheck,
  droplet: Droplet,
  minus: Minus,
  'external-link': ExternalLink,
  'message-circle': MessageCircle,
  'chevron-down': ChevronDown,
  'shopping-bag': ShoppingBag,
  x: X,
  image: ImageIcon,
  smile: Laugh, // this lucide version renamed "smile" to "face-grinning"/"laugh"
  'map-pin': MapPin,
  phone: Phone,
  // Voice-call screen (app/call/[callId].tsx) + the chat header's call
  // button. All four were missing, and the screen's hang-up button is not
  // something to let fall back to the placeholder circle.
  'phone-off': PhoneOff,
  mic: Mic,
  'mic-off': MicOff,
  headphones: Headphones,
  // Video calling (2026-10-11): the call screen's camera toggle and the
  // incoming sheet's answer button, which shows a camera for a video call.
  video: Video,
  'video-off': VideoOff,
  'switch-camera': SwitchCamera,
  'more-horizontal': Ellipsis,
  'user-plus': UserPlus,
  send: Send,
  // The chat composer's like button asked for this and got the
  // placeholder circle instead — it was the only name missing from the map.
  'thumbs-up': ThumbsUp,
  heart: Heart,
  'heart-pulse': HeartPulse,
  keyboard: Keyboard,
  layers: Layers,
  bone: Bone,
  sliders: SlidersHorizontal,
  camera: Camera,
  square: Square,
  'check-square': SquareCheck, // renamed upstream to square-check
  bookmark: Bookmark,
  clock: Clock,
  'file-text': FileText,
  flag: Flag,
  shield: Shield,
  'clipboard-check': ClipboardCheck,
  copy: Copy,
  crown: Crown,
  'rotate-ccw': RotateCcw,
  'refresh-cw': RefreshCw,
  'wifi-off': WifiOff,
  link: LinkIcon,
  sparkles: Sparkles,
  users: Users,
  'users-round': UsersRound,
  grid: LayoutGrid, // no bare "grid" glyph in this lucide version
  dumbbell: Dumbbell,
  smartphone: Smartphone,
  brain: Brain,
  library: Library,
  accessibility: Accessibility,
  'message-square': MessageSquare,
  film: Film,
  'qr-code': QrCode,
  box: Box,
  star: Star,
  search: Search,
  'trash-2': Trash2,
  eye: Eye,
  'eye-off': EyeOff,
  filter: Funnel, // renamed upstream to funnel
  globe: Globe,
  download: Download,
  'trending-up': TrendingUp,
  megaphone: Megaphone,
  check: Check,
  plus: Plus,
  user: User,
  'user-x': UserX,
  pencil: Pencil,
  home: House, // renamed upstream to house
  calendar: Calendar,
  pause: Pause,
  'volume-2': Volume2,
  'volume-x': VolumeX,
  zap: Zap,
  flame: Flame,
};

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, color = '#16213A', strokeWidth = 1.8 }: IconProps) {
  const LucideComponent = ICONS[name];
  if (!LucideComponent) {
    if (__DEV__) console.warn(`Icon: no mapping for "${name}", rendering placeholder`);
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={strokeWidth} fill="none" />
      </Svg>
    );
  }
  return <LucideComponent size={size} color={color} strokeWidth={strokeWidth} />;
}
