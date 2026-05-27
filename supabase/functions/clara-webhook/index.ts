// Supabase Edge Function (Deno) for receiving Clara Webhooks
// Deploy via: supabase functions deploy clara-webhook

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-clara-signature",
};

serve(async (req) => {
  // Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get the payload
    const body = await req.json();
    console.log("[Clara Webhook] Received payload:", JSON.stringify(body));

    // 2. Validate Event Type
    // Clara webhook event structure is typically like: { "event": "TRANSACTION_CREATED", "data": { ... } }
    const eventType = body.event || body.type;
    if (eventType !== "TRANSACTION_CREATED" && eventType !== "charge.succeeded") {
      console.log(`[Clara Webhook] Ignoring event type: ${eventType}`);
      return new Response(
        JSON.stringify({ status: "ignored", message: `Event ${eventType} is not processed.` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const txData = body.data;
    if (!txData) {
      throw new Error("Missing 'data' block in Clara webhook payload.");
    }

    // 3. Extract transaction details
    const txId = txData.id;
    const amount = txData.amount?.value || txData.amount || 0;
    const merchantName = txData.merchant?.name || txData.merchant || "Comercio Clara";
    
    // Clara card info
    const cardLastFour = txData.card?.last_four || txData.card?.last4 || "0000";
    
    // Timestamp
    const createdAt = txData.created_at || new Date().toISOString();

    if (!txId) {
      throw new Error("Missing transaction 'id' in payload.");
    }

    console.log(`[Clara Webhook] Processing Transaction ${txId}: ${amount} MXN at ${merchantName}`);

    // 4. Upsert the transaction in the database
    // We use service role client to bypass RLS policies for writing transactions.
    const { data, error } = await supabase
      .from("clara_transactions")
      .upsert({
        id: txId,
        fecha: createdAt,
        merchant: merchantName,
        monto: Number(amount),
        card_last_4: cardLastFour,
        created_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error("[Clara Webhook] Database upsert error:", error);
      throw error;
    }

    console.log("[Clara Webhook] Database upsert success:", data);

    return new Response(
      JSON.stringify({ status: "success", transactionId: txId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[Clara Webhook] Error:", err.message);
    return new Response(
      JSON.stringify({ status: "error", error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
