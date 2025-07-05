// send_weekly_email.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ulaaelkluixsmqozeaaa.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsYWFlbGtsdWl4c21xb3plYWFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTczNDk0NSwiZXhwIjoyMDU3MzEwOTQ1fQ.ENzDmP1jwWDfNICXwqBEAKZW7oSkTGbTISUdahacxwc'; // DO NOT expose this publicly

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function sendReauthEmail(email) {
  const { error } = await supabase.auth.admin.sendEmail({
    email: email,
    type: 'reauthentication'  // This sends the template you customized
  });

  if (error) {
    console.error(`❌ Failed to send email to ${email}:`, error.message);
  } else {
    console.log(`✅ Email sent to ${email}`);
  }
}

// Add email addresses here manually or from a list
const recipients = [
  'd.webstr@gmail.com',
];

(async () => {
  for (const email of recipients) {
    await sendReauthEmail(email);
  }
})();
