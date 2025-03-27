
// This file is automatically generated. Do not edit it directly.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://izvfwjwobghxwjvmypyn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dmZ3andvYmdoeHdqdm15cHluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTM1NTIsImV4cCI6MjA1ODYyOTU1Mn0.kqAVfO1Ut0kng2aQzORqZ2GXnrgVDygmOiWcT_pCcc0";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

// Create a singleton instance of the Supabase client
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // Prevent automatic URL detection
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache', // Prevent caching for all requests
    },
    fetch: (url, options) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      // Add timestamp to URLs to prevent caching when needed
      const urlWithCache = url.toString().includes('?') 
        ? `${url}&_t=${Date.now()}` 
        : `${url}?_t=${Date.now()}`;
      
      return fetch(urlWithCache, {
        ...options,
        signal: controller.signal,
        cache: 'no-cache',
      }).finally(() => {
        clearTimeout(timeoutId);
      });
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
