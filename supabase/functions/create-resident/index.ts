import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the calling user is a program leader
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user: callingUser },
    } = await anonClient.auth.getUser();
    if (!callingUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await anonClient
      .from("profiles")
      .select("role, program_id, is_approved")
      .eq("id", callingUser.id)
      .single();

    if (
      !callerProfile?.is_approved ||
      !["chief_resident", "program_coordinator", "program_director", "admin"].includes(callerProfile.role)
    ) {
      return new Response(
        JSON.stringify({ error: "Only program leaders can create residents" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();
    const {
      email,
      first_name,
      last_name,
      phone_number,
      pgy,
      specialty,
      role = "resident",
    } = body;

    if (!email || !first_name || !last_name || !pgy || !specialty) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, first_name, last_name, pgy, specialty" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use service role client to create the auth user
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Generate a random password (resident will reset via email)
    const randomPassword = crypto.randomUUID() + "Aa1!";

    // Create the auth user
    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password: randomPassword,
        email_confirm: true,
      });

    if (createError) {
      const msg = createError.message?.includes("already been registered")
        ? "A user with this email already exists"
        : createError.message;
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update the profile (created by trigger) with resident details
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        first_name,
        last_name,
        phone_number: phone_number || null,
        pgy,
        specialty,
        role,
        program_id: callerProfile.program_id,
        is_profile_complete: true,
        is_approved: true,
      })
      .eq("id", newUser.user.id);

    if (profileError) {
      // Clean up: delete the auth user if profile update fails
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ error: "Failed to create profile: " + profileError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate password recovery link and send email
    const { error: recoveryError } =
      await adminClient.auth.admin.generateLink({
        type: "recovery",
        email,
      });

    // Don't fail the whole operation if email fails — the user is created
    const emailSent = !recoveryError;

    return new Response(
      JSON.stringify({
        success: true,
        user_id: newUser.user.id,
        email_sent: emailSent,
        message: emailSent
          ? `Resident created. Password setup email sent to ${email}.`
          : `Resident created but email failed to send. Use "Resend Invite" to try again.`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
