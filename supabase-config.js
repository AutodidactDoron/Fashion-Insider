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
  // Messages: public.messages — sender_id, channel_id, content
  // Insert uses exactly those columns. Realtime on public.messages.
  // ---------------------------------------------------------------------------
  var messagesChannel = null;
  var currentChannelId = 'general';

  function getAuthUserId() {
    if (!supabase || !supabase.auth) return Promise.resolve(null);
    return supabase.auth.getUser().then(function (res) {
      return (res.data && res.data.user && res.data.user.id) || null;
    }).catch(function (err) {
      console.error('[Auth] getUser error:', err);
      return null;
    });
  }

  function getAuthUser() {
    if (!supabase || !supabase.auth) return Promise.resolve(null);
    return supabase.auth.getUser().then(function (res) {
      return (res.data && res.data.user) || null;
    }).catch(function (err) {
      console.error('[Auth] getUser error:', err);
      return null;
    });
  }

  function insertMessage(senderId, channelId, content) {
    if (!supabase) return Promise.reject(new Error('Supabase not configured'));
    var row = {
      sender_id: senderId,
      channel_id: channelId || currentChannelId,
      content: content
    };
    console.log('[Messages] Insert payload:', row);
    return supabase
      .from('messages')
      .insert(row)
      .then(function (res) {
        if (res.error) {
          console.error('[Messages] Insert failed:', res.error.message, res.error.details, res.error.hint, res.error);
          return Promise.reject(res.error);
        }
        console.log('[Messages] Insert response:', res.data);
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
        var row = payload && payload.new;
        if (!row || !onInsert) return;
        onInsert({
          sender_id: row.sender_id,
          channel_id: row.channel_id,
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

  // ---------------------------------------------------------------------------
  // Parties: create party, join/leave, fetch members with profiles, realtime
  // ---------------------------------------------------------------------------
  var partyChannel = null;

  function createParty() {
    if (!supabase) return Promise.reject(new Error('Supabase not configured'));
    return getAuthUserId().then(function (uid) {
      if (!uid) return Promise.reject(new Error('Not authenticated'));
      return supabase.from('parties').insert({ created_by: uid }).select('id').single();
    }).then(function (res) {
      if (res.error) return Promise.reject(res.error);
      return res.data && res.data.id;
    });
  }

  function joinParty(partyId) {
    if (!supabase) return Promise.reject(new Error('Supabase not configured'));
    return getAuthUserId().then(function (uid) {
      if (!uid) return Promise.reject(new Error('Not authenticated'));
      return supabase.from('party_members').insert({ party_id: partyId, user_id: uid }).select().single();
    }).then(function (res) {
      if (res.error) return Promise.reject(res.error);
      return res.data;
    });
  }

  function leaveParty(partyId) {
    if (!supabase) return Promise.reject(new Error('Supabase not configured'));
    return getAuthUserId().then(function (uid) {
      if (!uid) return Promise.reject(new Error('Not authenticated'));
      return supabase.from('party_members').delete().eq('party_id', partyId).eq('user_id', uid);
    });
  }

  function getPartyMembers(partyId) {
    if (!supabase) return Promise.resolve([]);
    return supabase.from('party_members').select('user_id, profiles(email, avatar_url, display_name)').eq('party_id', partyId).then(function (r) {
      if (r.error) return [];
      return (r.data || []).map(function (row) {
        var p = row.profiles || {};
        return { user_id: row.user_id, email: p.email, avatar_url: p.avatar_url, display_name: p.display_name };
      });
    });
  }

  function subscribeToPartyMembers(partyId, onChanges) {
    if (!supabase || !partyId || !onChanges) return;
    if (partyChannel) {
      supabase.removeChannel(partyChannel);
      partyChannel = null;
    }
    partyChannel = supabase.channel('party-members-' + partyId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_members', filter: 'party_id=eq.' + partyId }, function () {
        getPartyMembers(partyId).then(onChanges);
      })
      .subscribe();
  }

  function unsubscribeParty() {
    if (supabase && partyChannel) {
      supabase.removeChannel(partyChannel);
      partyChannel = null;
    }
  }

  function upsertProfile(id, data) {
    if (!supabase) return Promise.reject(new Error('Supabase not configured'));
    return supabase.from('profiles').upsert({ id: id, updated_at: new Date().toISOString(), email: data.email, display_name: data.display_name, avatar_url: data.avatar_url }, { onConflict: 'id' });
  }

  window.FashionInsiderSupabase = {
    getSupabase: getSupabase,
    isSupabaseEnabled: isSupabaseEnabled,
    getAuthUserId: getAuthUserId,
    getAuthUser: getAuthUser,
    insertMessage: insertMessage,
    subscribeToMessages: subscribeToMessages,
    unsubscribeMessages: unsubscribeMessages,
    setCurrentChannelId: function (id) { currentChannelId = id || 'general'; },
    getCurrentChannelId: function () { return currentChannelId; },
    updateWalletBalance: updateWalletBalance,
    fetchWalletBalance: fetchWalletBalance,
    createParty: createParty,
    joinParty: joinParty,
    leaveParty: leaveParty,
    getPartyMembers: getPartyMembers,
    subscribeToPartyMembers: subscribeToPartyMembers,
    unsubscribeParty: unsubscribeParty,
    upsertProfile: upsertProfile
  };
})();
