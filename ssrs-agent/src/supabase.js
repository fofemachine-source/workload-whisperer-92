require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltando SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no arquivo .env");
}

const supabase = createClient(supabaseUrl || 'http://localhost', supabaseKey || 'fake-key');

module.exports = supabase;
