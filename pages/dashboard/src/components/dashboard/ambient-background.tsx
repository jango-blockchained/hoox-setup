'use client';

import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

interface AmbientBackgroundProps {
  children: React.ReactNode;
}

const variantGradients = {
  default: {
    primary: 'from-primary/5',
    secondary: 'from-blue-500/3',
    accent: 'from-purple-500/3',
  },
  positions: {
    primary: 'from-green-500/5',
    secondary: 'from-emerald-500/3',
    accent: 'from-teal-500/3',
  },
  logs: {
    primary: 'from-orange-500/5',
    secondary: 'from-amber-500/3',
    accent: 'from-yellow-500/3',
  },
  settings: {
    primary: 'from-blue-500/5',
    secondary: 'from-indigo-500/3',
    accent: 'from-cyan-500/3',
  },
  setup: {
    primary: 'from-purple-500/5',
    secondary: 'from-violet-500/3',
    accent: 'from-fuchsia-500/3',
  },
  signal: {
    primary: 'from-pink-500/5',
    secondary: 'from-rose-500/3',
    accent: 'from-red-500/3',
  },
};

export function AmbientBackground({ children }: AmbientBackgroundProps) {
  const pathname = usePathname();
  
  let variant: keyof typeof variantGradients = 'default';
  if (pathname?.includes('/positions')) variant = 'positions';
  else if (pathname?.includes('/logs')) variant = 'logs';
  else if (pathname?.includes('/settings')) variant = 'settings';
  else if (pathname?.includes('/setup')) variant = 'setup';
  else if (pathname?.includes('/signal-flow')) variant = 'signal';
  
  const gradients = variantGradients[variant];
  
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className={`absolute -top-40 -left-40 h-80 w-80 rounded-full bg-gradient-to-r ${gradients.primary} blur-3xl`}
          animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className={`absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-gradient-to-l ${gradients.secondary} blur-3xl`}
          animate={{ x: [0, -80, 0], y: [0, -60, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className={`absolute top-1/2 left-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br ${gradients.accent} blur-3xl`}
          animate={{ x: [0, 60, 0], y: [0, -40, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        />
      </div>
      
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
