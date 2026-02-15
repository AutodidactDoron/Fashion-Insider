/**
 * Supabase client and real-time helpers.
 * Set window.SUPABASE_URL and window.SUPABASE_ANON_KEY in index.html or env, or leave null to run without backend.
 */
(function () {
  'use strict';

  var SUPABASE_URL = window.SUPABASE_URL || null;
  var SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || null;
  var supabase = null;

  if (window.supabase && typeof window.supabase.createClient === 'function' && SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
      console.warn('Supabase init failed', e);
    }
  }

  function getSupabase() {
    return supabase;
  }

  function isSupabaseEnabled() {
    return supabase !== null;
  }

  // ---------------------------------------------------------------------------
  // Messages: insert and subscribe to INSERT for real-time
  // ---------------------------------------------------------------------------
  var messagesChannel = null;
  var currentChannelId = 'general';

  function insertMessage(channelId, senderId, senderName, content) {
    if (!supabase) return Promise.reject(new Error('Supabase not configured'));
    return supabase
      .from('messages')
      .insert({
        channel_id: channelId || currentChannelId,
        sender_id: senderId,
        sender_name: senderName || 'User',
        content: content,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
  }

  function subscribeToMessages(channelId, onInsert) {
    if (!supabase || !onInsert) return;
    if (messagesChannel) {
      supabase.removeChannel(messagesChannel);
      messagesChannel = null;
    }
    var ch = channelId || currentChannelId;
    messagesChannel = supabase
      .channel('messages-' + ch)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: 'channel_id=eq.' + ch },
        function (payload) {
          var row = payload.new;
          if (row && onInsert) onInsert({ id: row.id, sender_id: row.sender_id, sender_name: row.sender_name, content: row.content, created_at: row.created_at });
        }
      )
      .subscribe();
  }

  function unsubscribeMessages() {
    if (supabase && messagesChannel) {
      supabase.removeChannel(messagesChannel);
      messagesChannel = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Wallet: update balance in Supabase (e.g. profiles.wallet_balance or wallet table)
  // ---------------------------------------------------------------------------
  function updateWalletBalance(userId, newBalance) {
    if (!supabase) return Promise.reject(new Error('Supabase not configured'));
    // Assume table 'profiles' with columns id, wallet_balance; or a 'wallets' table
    return supabase
      .from('profiles')
      .update({ wallet_balance: newBalance })
      .eq('id', userId);
  }

  function fetchWalletBalance(userId) {
    if (!supabase) return Promise.resolve(null);
    return supabase
      .from('profiles')
      .select('wallet_balance')
      .eq('id', userId)
      .single()
      .then(function (r) { return r.data && r.data.wallet_balance != null ? r.data.wallet_balance : null; });
  }

  window.FashionInsiderSupabase = {
    getSupabase: getSupabase,
    isSupabaseEnabled: isSupabaseEnabled,
    insertMessage: insertMessage,
    subscribeToMessages: subscribeToMessages,
    unsubscribeMessages: unsubscribeMessages,
    setCurrentChannelId: function (id) { currentChannelId = id || 'general'; },
    getCurrentChannelId: function () { return currentChannelId; },
    updateWalletBalance: updateWalletBalance,
    fetchWalletBalance: fetchWalletBalance
  };
})();
