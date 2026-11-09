import { Activity, CircleCheck, Gauge, Megaphone, Plug, Settings, Target } from 'lucide-react';
import type { NavItem } from './Sidebar';

export const NAV_ITEMS: Array<Omit<NavItem, 'count' | 'countLabel'>> = [
  { section: 'goals', label: 'Goals', icon: Target },
  { section: 'approvals', label: 'Approvals', icon: CircleCheck },
  { section: 'activity', label: 'Activity', icon: Activity },
  { section: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { section: 'actions', label: 'Reviews', icon: Gauge },
  { section: 'marketing', label: 'Marketing', icon: Plug },
  { section: 'settings', label: 'Settings', icon: Settings },
];
