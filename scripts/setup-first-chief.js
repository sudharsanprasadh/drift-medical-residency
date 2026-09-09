#!/usr/bin/env node

/**
 * Setup First Chief Resident
 *
 * Use this script to bootstrap the first chief resident for a new program.
 * After this, the chief can add other residents from the app.
 *
 * Usage:
 *   node scripts/setup-first-chief.js
 *
 * Requires:
 *   - SUPABASE_SERVICE_ROLE_KEY env var (or it will prompt)
 *   - .env file with EXPO_PUBLIC_SUPABASE_URL
 */

const readline = require('readline');
const path = require('path');
const fs = require('fs');

// Load .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question, defaultValue) {
  return new Promise((resolve) => {
    const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

function askChoice(question, options) {
  return new Promise((resolve) => {
    console.log(`\n${question}`);
    options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt}`));
    rl.question('Choose (number): ', (answer) => {
      const idx = parseInt(answer) - 1;
      resolve(idx >= 0 && idx < options.length ? options[idx] : options[0]);
    });
  });
}

async function main() {
  console.log('\n=== Setup First Chief Resident ===\n');
  console.log('This script creates the first chief resident for a program.');
  console.log('After this, they can add other residents from the app.\n');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    console.error('Error: EXPO_PUBLIC_SUPABASE_URL not found in .env');
    process.exit(1);
  }

  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    serviceRoleKey = await ask('Supabase Service Role Key (from Dashboard → Settings → API)');
    if (!serviceRoleKey) {
      console.error('Service role key is required');
      process.exit(1);
    }
  }

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Step 1: Pick or show programs
  console.log('\n--- Step 1: Select Program ---\n');
  const { data: programs, error: progError } = await supabase
    .from('programs')
    .select('id, program_name, specialty, location')
    .order('program_name');

  if (progError) {
    console.error('Error fetching programs:', progError.message);
    process.exit(1);
  }

  if (programs.length === 0) {
    console.error('No programs found. Add a program first.');
    process.exit(1);
  }

  console.log('Available programs:');
  programs.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.program_name} (${p.specialty} - ${p.location})`);
  });

  const progChoice = await ask('\nSelect program number');
  const progIdx = parseInt(progChoice) - 1;
  if (progIdx < 0 || progIdx >= programs.length) {
    console.error('Invalid selection');
    process.exit(1);
  }
  const selectedProgram = programs[progIdx];
  console.log(`\nSelected: ${selectedProgram.program_name}`);

  // Step 2: Chief resident details
  console.log('\n--- Step 2: Chief Resident Details ---\n');
  const email = await ask('Email');
  if (!email) { console.error('Email is required'); process.exit(1); }

  const firstName = await ask('First Name');
  if (!firstName) { console.error('First name is required'); process.exit(1); }

  const lastName = await ask('Last Name');
  if (!lastName) { console.error('Last name is required'); process.exit(1); }

  const phone = await ask('Phone Number (optional)');

  const pgyOptions = ['PGY1', 'PGY2', 'PGY3', 'PGY4', 'PGY5', 'PGY6', 'PGY7', 'PGY8'];
  const pgy = await askChoice('PGY Level?', pgyOptions);

  const roleOptions = ['chief_resident', 'program_coordinator', 'program_director'];
  const role = await askChoice('Role?', roleOptions);

  // Step 3: Confirm
  console.log('\n--- Review ---\n');
  console.log(`  Program:    ${selectedProgram.program_name}`);
  console.log(`  Name:       ${firstName} ${lastName}`);
  console.log(`  Email:      ${email}`);
  console.log(`  Phone:      ${phone || '(none)'}`);
  console.log(`  PGY:        ${pgy}`);
  console.log(`  Role:       ${role}`);
  console.log(`  Specialty:  ${selectedProgram.specialty}`);

  const confirm = await ask('\nCreate this user? (yes/no)', 'yes');
  if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    console.log('Cancelled.');
    rl.close();
    return;
  }

  // Step 4: Create auth user
  console.log('\nCreating auth user...');
  const tempPassword = require('crypto').randomUUID() + 'Aa1!';

  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (createError) {
    console.error('Error creating user:', createError.message);
    rl.close();
    process.exit(1);
  }

  console.log(`Auth user created: ${newUser.user.id}`);

  // Step 5: Update profile
  console.log('Setting up profile...');
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      first_name: firstName,
      last_name: lastName,
      phone_number: phone || null,
      role,
      specialty: selectedProgram.specialty,
      program_id: selectedProgram.id,
      pgy,
      is_profile_complete: true,
      is_approved: true,
    })
    .eq('id', newUser.user.id);

  if (profileError) {
    console.error('Error updating profile:', profileError.message);
    console.log('Cleaning up auth user...');
    await supabase.auth.admin.deleteUser(newUser.user.id);
    rl.close();
    process.exit(1);
  }

  // Step 6: Send password reset email
  console.log('Sending password setup email...');
  const { error: recoveryError } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
  });

  console.log('\n=== Done! ===\n');
  console.log(`  ${firstName} ${lastName} has been set up as ${role} for ${selectedProgram.program_name}`);

  if (recoveryError) {
    console.log(`  ⚠ Password email failed: ${recoveryError.message}`);
    console.log(`  They can use "Forgot Password" on the login screen to set their password.`);
  } else {
    console.log(`  ✓ Password setup email sent to ${email}`);
  }

  console.log(`\n  They can now log in and add other residents from the Members tab.\n`);

  rl.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  rl.close();
  process.exit(1);
});
