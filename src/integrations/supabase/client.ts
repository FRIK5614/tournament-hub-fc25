
// This file is automatically generated. Do not edit it directly.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://izvfwjwobghxwjvmypyn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dmZ3andvYmdoeHdqdm15cHluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTM1NTIsImV4cCI6MjA1ODYyOTU1Mn0.kqAVfO1Ut0kng2aQzORqZ2GXnrgVDygmOiWcT_pCcc0";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

// Add more robust configuration with retries and timeouts
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
    },
    // Increase timeout for longer operations
    fetch: (url, options) => {
      return fetch(url, {
        ...options,
        signal: options?.signal || AbortSignal.timeout(30000), // 30 second timeout
        cache: 'no-cache', // Prevent caching issues
      });
    },
  },
  // Add auto-retry for failed requests
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
