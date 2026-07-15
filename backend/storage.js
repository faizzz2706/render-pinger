import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Supabase] Warning: SUPABASE_URL or SUPABASE_KEY environment variables are missing! Database calls will fail.');
}

const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co', 
  supabaseKey || 'placeholder-anon-key'
);

// Models translation helpers (Database snake_case -> Frontend camelCase)
function mapTargetToFrontend(target) {
  if (!target) return null;
  return {
    id: target.id,
    userId: target.user_id,
    name: target.name,
    url: target.url,
    interval: target.interval,
    active: target.active,
    createdAt: target.created_at
  };
}

function mapLogToFrontend(log) {
  if (!log) return null;
  return {
    id: log.id,
    userId: log.user_id,
    targetId: log.target_id,
    targetName: log.target_name,
    url: log.url,
    status: log.status,
    statusCode: log.status_code,
    responseTime: log.response_time,
    errorMessage: log.error_message,
    timestamp: log.timestamp
  };
}

function mapSettingsToFrontend(settings) {
  if (!settings) return null;
  return {
    selfPingEnabled: settings.self_ping_enabled,
    selfPingUrl: settings.self_ping_url,
    maxLogsCount: settings.max_logs_count
  };
}

// 1. Target Operations (Scoped by userId)
export async function getTargets(userId) {
  // If no userId is provided (e.g. at boot by pinger engine to reschedule all pings), fetch all targets
  const query = supabase
    .from('targets')
    .select('*')
    .order('created_at', { ascending: true });

  if (userId) {
    query.eq('user_id', userId);
  }

  try {
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapTargetToFrontend);
  } catch (err) {
    console.error('[Supabase] Error fetching targets:', err.message);
    return [];
  }
}

export async function addTarget(target, userId) {
  if (!userId) throw new Error('Authentication required to add targets');

  const newTarget = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    user_id: userId,
    name: target.name || 'Unnamed Target',
    url: target.url,
    interval: parseInt(target.interval, 10) || 60,
    active: target.active !== false,
    created_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from('targets')
      .insert([newTarget])
      .select()
      .single();

    if (error) throw error;
    return mapTargetToFrontend(data);
  } catch (err) {
    console.error('[Supabase] Error adding target:', err.message);
    throw err;
  }
}

export async function updateTarget(id, updates, userId) {
  if (!userId) throw new Error('Authentication required to update targets');

  const dbUpdates = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.url !== undefined) dbUpdates.url = updates.url;
  if (updates.interval !== undefined) dbUpdates.interval = parseInt(updates.interval, 10);
  if (updates.active !== undefined) dbUpdates.active = updates.active;

  try {
    const { data, error } = await supabase
      .from('targets')
      .update(dbUpdates)
      .eq('id', id)
      .eq('user_id', userId) // Scope to user
      .select()
      .single();

    if (error) throw error;
    return mapTargetToFrontend(data);
  } catch (err) {
    console.error('[Supabase] Error updating target:', err.message);
    return null;
  }
}

export async function deleteTarget(id, userId) {
  if (!userId) throw new Error('Authentication required to delete targets');

  try {
    const { error } = await supabase
      .from('targets')
      .delete()
      .eq('id', id)
      .eq('user_id', userId); // Scope to user

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('[Supabase] Error deleting target:', err.message);
    return false;
  }
}

// 2. Logs Operations (Scoped by userId)
export async function getLogs(userId) {
  if (!userId) return [];

  try {
    const settings = await getSettings(userId);
    const maxLogs = settings.maxLogsCount || 200;

    const { data, error } = await supabase
      .from('logs')
      .select('*')
      .eq('user_id', userId) // Scope to user
      .order('timestamp', { ascending: false })
      .limit(maxLogs);

    if (error) throw error;
    return (data || []).map(mapLogToFrontend);
  } catch (err) {
    console.error('[Supabase] Error fetching logs:', err.message);
    return [];
  }
}

export async function addLog(log) {
  // log.userId should be supplied by the pinger engine target details
  if (!log.userId) {
    console.error('[Supabase] Cannot log ping result: missing userId target detail');
    return null;
  }

  const dbLog = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    user_id: log.userId,
    target_id: log.targetId,
    target_name: log.targetName,
    url: log.url,
    status: log.status,
    status_code: log.statusCode,
    response_time: log.responseTime || 0,
    error_message: log.errorMessage,
    timestamp: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from('logs')
      .insert([dbLog])
      .select()
      .single();

    if (error) throw error;

    // Prune excess logs in background (scoped to user)
    pruneOldLogs(log.userId).catch(err => console.error('[Supabase] Background log pruning error:', err.message));

    return mapLogToFrontend(data);
  } catch (err) {
    console.error('[Supabase] Error adding log:', err.message);
    throw err;
  }
}

// Helper to prune logs in background specifically for one user
async function pruneOldLogs(userId) {
  try {
    const settings = await getSettings(userId);
    const maxLogs = settings.maxLogsCount || 200;

    // Fetch primary keys of rows specifically for this user that fall outside the limit range
    const { data, error } = await supabase
      .from('logs')
      .select('id')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .range(maxLogs, maxLogs + 100);

    if (error) throw error;

    if (data && data.length > 0) {
      const idsToDelete = data.map(row => row.id);
      const { error: deleteError } = await supabase
        .from('logs')
        .delete()
        .in('id', idsToDelete)
        .eq('user_id', userId); // Scoped delete
        
      if (deleteError) throw deleteError;
    }
  } catch (err) {
    console.error(`[Supabase] Log pruning check failed for user ${userId}:`, err.message);
  }
}

export async function clearLogs(userId) {
  if (!userId) throw new Error('Authentication required to clear logs');

  try {
    const { error } = await supabase
      .from('logs')
      .delete()
      .eq('user_id', userId); // Scoped delete

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('[Supabase] Error clearing logs:', err.message);
    return false;
  }
}

// 3. Settings Operations (Scoped by userId)
export async function getSettings(userId) {
  if (!userId) {
    return { selfPingEnabled: false, selfPingUrl: '', maxLogsCount: 200 };
  }

  const defaultSettings = {
    user_id: userId,
    self_ping_enabled: false,
    self_ping_url: process.env.RENDER_EXTERNAL_URL || process.env.SELF_PING_URL || '',
    max_logs_count: 200
  };

  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      // If table has no record for this user, seed it
      const { data: seeded, error: seedError } = await supabase
        .from('settings')
        .insert([defaultSettings])
        .select()
        .single();
        
      if (seedError) throw seedError;
      return mapSettingsToFrontend(seeded);
    }

    // Force update URL if environment has it but database doesn't
    const resolvedUrl = data.self_ping_url || process.env.RENDER_EXTERNAL_URL || process.env.SELF_PING_URL || '';
    if (data.self_ping_enabled && !data.self_ping_url && resolvedUrl) {
      await supabase.from('settings').update({ self_ping_url: resolvedUrl }).eq('user_id', userId);
      data.self_ping_url = resolvedUrl;
    }

    return mapSettingsToFrontend(data);
  } catch (err) {
    console.error(`[Supabase] Error loading settings for user ${userId}:`, err.message);
    return mapSettingsToFrontend(defaultSettings);
  }
}

export async function updateSettings(updates, userId) {
  if (!userId) throw new Error('Authentication required to update settings');

  const dbUpdates = {};
  if (updates.selfPingEnabled !== undefined) {
    dbUpdates.self_ping_enabled = updates.selfPingEnabled;
    dbUpdates.self_ping_url = process.env.RENDER_EXTERNAL_URL || process.env.SELF_PING_URL || '';
  }
  if (updates.maxLogsCount !== undefined) dbUpdates.max_logs_count = parseInt(updates.maxLogsCount, 10);

  try {
    const { data, error } = await supabase
      .from('settings')
      .update(dbUpdates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return mapSettingsToFrontend(data);
  } catch (err) {
    console.error(`[Supabase] Error saving settings for user ${userId}:`, err.message);
    return await getSettings(userId);
  }
}

export async function getAllActiveSelfPings() {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('self_ping_url')
      .eq('self_ping_enabled', true);

    if (error) throw error;
    return (data || []).map(row => row.self_ping_url).filter(Boolean);
  } catch (err) {
    console.error('[Supabase] Error loading all active self-pings:', err.message);
    return [];
  }
}

// Export Supabase Auth Client for Auth Routing
export { supabase };
