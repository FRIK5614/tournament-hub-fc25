
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.36.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Get environment variables
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Create tournament-media bucket if it doesn't exist
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets()

    if (bucketsError) {
      throw bucketsError
    }

    const bucketExists = buckets.some(bucket => bucket.name === 'tournament-media')

    if (!bucketExists) {
      const { error } = await supabase
        .storage
        .createBucket('tournament-media', {
          public: true, // Make files publicly accessible
          fileSizeLimit: 10485760, // 10MB limit for match screenshots
        })

      if (error) {
        throw error
      }
    }

    // Set public policy for the bucket
    const { error: policyError } = await supabase
      .storage
      .from('tournament-media')
      .createSignedUploadUrl('test-policy-file.txt')

    // Create a test file to ensure bucket is working
    if (policyError) {
      const { error: publicPolicyError } = await supabase
        .storage
        .from('tournament-media')
        .getPublicUrl('test-policy-file.txt')

      if (publicPolicyError) {
        console.error('Error setting public policy:', publicPolicyError)
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Storage bucket created or already exists' }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    )
  } catch (error) {
    console.error('Error creating storage bucket:', error)
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400, 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})
