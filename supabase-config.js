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
  // Messages: public.messages — sender_id (uuid), receiver_id (uuid), content (text)
  // Insert uses exactly those columns. Realtime channel 'public:messages'.
  // ---------------------------------------------------------------------------
  var messagesChannel = null;
  var currentReceiverId = null;

  function getAuthUserId() {
    if (!supabase || !supabase.auth) return Promise.resolve(null);
    return supabase.auth.getUser().then(function (res) {
      var id = res.data && res.data.user && res.data.user.id;
      if (id) console.log('[Messages] Current user id (auth):', id);
      return id || null;
    }).catch(function (err) {
      console.error('[Messages] auth.getUser error:', err);
      return null;
    });
  }

  function insertMessage(senderId, receiverId, content) {
    if (!supabase) return Promise.reject(new Error('Supabase not configured'));
    var row = {
      sender_id: senderId,
      receiver_id: receiverId,
      content: content
    };
    console.log('[Messages] Insert payload:', row);
    return supabase
      .from('messages')
      .insert(row)
      .then(function (res) {
        console.log('[Messages] Insert response:', res.data, 'error:', res.error);
        if (res.error) return Promise.reject(res.error);
        return res;
      });
  }

  function subscribeToMessages(currentUserId, onInsert) {
    if (!supabase || !onInsert) return;
    if (messagesChannel) {
      supabase.removeChannel(messagesChannel);
      messagesChannel = null;
    }
    var channel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, function (payload) {
        console.log('[Messages] Realtime INSERT payload:', payload);
        var row = payload && payload.new;
        if (!row || !onInsert) return;
        onInsert({
          sender_id: row.sender_id,
          receiver_id: row.receiver_id,
          content: row.content
        });
      })
      .subscribe(function (status, err) {
        console.log('[Messages] Realtime subscription status:', status);
        if (err) console.error('[Messages] Realtime subscription error:', err);
      });
    messagesChannel = channel;
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
    getAuthUserId: getAuthUserId,
    insertMessage: insertMessage,
    subscribeToMessages: subscribeToMessages,
    unsubscribeMessages: unsubscribeMessages,
    setCurrentReceiverId: function (id) { currentReceiverId = id; },
    getCurrentReceiverId: function () { return currentReceiverId; },
    updateWalletBalance: updateWalletBalance,
    fetchWalletBalance: fetchWalletBalance
  };
})();
