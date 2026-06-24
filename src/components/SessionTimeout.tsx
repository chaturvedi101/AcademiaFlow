'use client';

import { useEffect, useRef } from 'react';
import { useAuth, useUser } from '@/firebase';
import { useRouter } from 'next/navigation';

const TIMEOUT_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Monitors user activity and automatically signs out the user after 5 minutes of inactivity.
 */
export function SessionTimeout() {
  const { user } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = () => {
    auth.signOut().then(() => {
      router.push('/');
    });
  };

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (user) {
      timeoutRef.current = setTimeout(handleLogout, TIMEOUT_DURATION);
    }
  };

  useEffect(() => {
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click'
    ];

    if (user) {
      resetTimer();
      activityEvents.forEach((event) => {
        window.addEventListener(event, resetTimer);
      });
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user, auth, router]);

  return null;
}
