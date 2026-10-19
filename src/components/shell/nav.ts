import { Activity, CircleCheck, Megaphone, Settings, Target } from 'lucide-react';
import type { NavItem } from './Sidebar';

export const NAV_ITEMS: Array<Omit<NavItem, 'count' | 'countLabel'>> = [
  { section: 'goals', label: 'Goals', icon: Target },
  { section: 'approvals', label: 'Approvals', icon: CircleCheck },
  { section: 'activity', label: 'Activity', icon: Activity },
  { section: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { section: 'settings', label: 'Settings', icon: Settings },
];
