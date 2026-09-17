/* Account synchronization uses an authenticated, atomic database RPC. */
(() => {
  const $ = (id) => document.getElementById(id);
  const dialog = $('account-dialog');
  let client = null, user = null, loaded = false, busy = false, queue = [];
  let authVersion = 0;
  let family = null, activeChild = 'default';
  const account = window.readingAccount = { state: ProgressModel.fresh(), record, preferences };
  function status(message) {
    $('sync-status').textContent = message;
    $('reader-save-status').textContent = message;
  }
  function render() {
    const state = account.state;
    $('child-select').replaceChildren();
    for (const [id, child] of Object.entries(family?.children || {})) $('child-select').appendChild(new Option(child.name, id));
    $('child-select').value = activeChild;
    $('child-select').disabled = busy || queue.length > 0 || !loaded;
    $('add-child-form').querySelector('button').disabled = busy || queue.length > 0 || !loaded;
    $('journey-title').textContent = `${state.name}'s reading journey`;
    $('reader-greeting').textContent = `HELLO, ${state.name.toUpperCase()}!`;
    $('open-profile').textContent = state.name.slice(0, 1).toUpperCase();
    $('reader-name').value = state.name;
    $('signed-in').hidden = !user;
    $('signed-out').hidden = Boolean(user);
    $('refresh-progress').disabled = !user || busy;
    const stats = ProgressModel.summary(state, books);
    for (const [id, value] of Object.entries({ books: stats.completed, pages: stats.pages, words: stats.words, started: stats.started })) $('stat-' + id).textContent = value;
    $('reading-history').replaceChildren();
    for (const book of books) {
      const record = state.books[book.id];
      if (!record) continue;
      const row = document.createElement('div'); row.className = 'history-row';
      const detail = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = `${book.emoji} ${book.title}`;
      const note = document.createElement('small');
      const finished = book.pages.filter((text, i) => (record.pages[i] || 0) >= text.split(' ').length).length;
      note.textContent = record.completedAt ? `Completed ${new Date(record.completedAt).toLocaleDateString()} · ${gradeName(book.grade)} · ${book.pages.length} pages` : `${finished} of ${book.pages.length} pages completed · ${gradeName(book.grade)}`;
      detail.append(title, note);
      const button = document.createElement('button'); button.className = 'account-button';
      button.textContent = record.completedAt ? 'Read again' : 'Continue';
      button.addEventListener('click', () => openBook(book));
      row.append(detail, button); $('reading-history').appendChild(row);
    }
    renderBooks(document.querySelector('.filter.active').dataset.grade);
  }
  async function rpc(kind, payload = {}) {
    const { data, error } = await client.rpc('reading_family', { action: kind, payload });
    if (error) throw error;
    return data;
  }
  function apply(data) {
    family = data;
    if (!family.children[activeChild]) activeChild = Object.keys(family.children)[0];
    const state = { ...family.children[activeChild], generation: family.generation };
    if (state.generation !== account.state.generation) {
      closeReader();
      $('celebration').classList.remove('show');
      $('celebration').setAttribute('aria-hidden', 'true');
    }
    account.state = state;
    render(); loadVoices();
    if (activeBook && $('celebration').classList.contains('show')) {
      const complete = state.books[activeBook.id]?.completedAt;
      document.querySelector('#celebration p').textContent = complete ? `You completed ${activeBook.title}! It is saved on your bookshelf.` : 'Page complete! Read every page to finish this book.';
    }
  }
  async function refresh() {
    if (!user || busy || queue.length) return;
    const version = authVersion;
    try {
      const data = await rpc('load');
      if (version !== authVersion || busy || queue.length) return;
      apply(data); loaded = true; render();
      status('Progress synced across your devices.');
      $('account-status').textContent = `Signed in as ${user.email}.`;
    } catch {
      status('Could not load your saved progress. Check your connection and press Refresh progress.');
      $('refresh-progress').disabled = false;
    }
  }
  async function drain() {
    if (busy || !loaded || !user) return;
    busy = true;
    const version = authVersion;
    try {
      while (queue.length && version === authVersion) {
        const item = queue[0];
        status('Saving your progress…');
        const data = await rpc(item.kind, item.payload);
        if (version !== authVersion) return;
        queue.shift();
        if (item.kind === 'add_child') activeChild = item.payload.childId;
        apply(data);
        if (item.kind === 'preferences') celebrate('Saved for ' + account.state.name);
        if (item.kind === 'add_child') { $('new-child-name').value = ''; celebrate('Welcome, ' + account.state.name + '!', true); }
      }
      status('Progress saved and synced.');
      if (dialog.open) $('account-status').textContent = 'Your changes are saved.';
    } catch (error) {
      if (dialog.open) $('account-status').textContent = 'Changes are not saved. Close this panel and use Refresh progress to retry.';
      if (version !== authVersion) return;
      if (String(error.message).includes('reset on another device')) {
        queue = []; loaded = false;
        status('Your progress was reset on another device. Refresh to start again.');
      } else status('Changes are not saved yet. Keep this tab open and press Refresh progress to retry.');
    } finally { busy = false; render(); if (version !== authVersion && user && !loaded) void refresh(); }
  }
  function enqueue(kind, payload) {
    if (!loaded || !user) { status('Sign in and load your account to save progress.'); return; }
    queue.push({ kind, payload: { ...payload, childId: payload.childId || activeChild, generation: account.state.generation } });
    void drain(); render();
  }
  function record(book, page, words, generation) {
    if (generation !== account.state.generation) return;
    enqueue('progress', { book, page, words });
  }
  function preferences(changes) {
    if (!user) {
      Object.assign(account.state, changes);
      status('Voice preference applies to this visit. Sign in to save it.');
      return;
    }
    enqueue('preferences', changes);
  }
  for (const id of ['open-account', 'open-profile']) $(id).addEventListener('click', () => dialog.showModal());
  $('refresh-progress').addEventListener('click', async () => { if (queue.length) await drain(); else await refresh(); });
  $('profile-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = $('reader-name').value.trim();
    if (name) preferences({ name });
  });
  $('child-select').addEventListener('change', () => {
    if (busy || queue.length || !family) { render(); return; }
    closeReader(); activeChild = $('child-select').value; apply(family);
    celebrate(`It's ${account.state.name}'s turn!`, true);
  });
  $('add-child-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = $('new-child-name').value.trim();
    if (!name || busy || queue.length) return;
    enqueue('add_child', { childId: crypto.randomUUID(), name });
  });
  $('reset-start').addEventListener('click', () => { $('reset-confirmation').hidden = false; $('reset-confirm').focus(); });
  $('reset-cancel').addEventListener('click', () => { $('reset-confirmation').hidden = true; });
  dialog.addEventListener('close', () => { $('reset-confirmation').hidden = true; });
  $('reset-confirm').addEventListener('click', async () => {
    if (!user || busy) { $('account-status').textContent = 'Please wait for the current save, then try resetting again.'; return; }
    busy = true; $('reset-confirm').disabled = true;
    const version = authVersion;
    try {
      const data = await rpc('reset');
      if (version !== authVersion) return;
      queue = []; apply(data); loaded = true;
      $('reset-confirmation').hidden = true;
      $('account-status').textContent = 'Everything has been reset. Your sign-in account is still active.';
      status('Fresh start! All children and progress have been reset.');
      celebrate('A fresh start!', true);
    } catch { $('account-status').textContent = 'Reset failed. Your saved data has not been cleared. Please retry.'; }
    finally { busy = false; $('reset-confirm').disabled = false; render(); }
  });
  $('sign-out').addEventListener('click', async () => {
    if (busy || queue.length) { $('account-status').textContent = 'Please finish syncing using Refresh progress before signing out.'; return; }
    const { error } = await client.auth.signOut();
    if (error) $('account-status').textContent = 'Could not sign out. Please retry.';
    else celebrate('Signed out safely.');
  });
  $('sign-in').addEventListener('click', async () => {
    const email = $('account-email');
    if (!email.reportValidity() || !client) return;
    const button = $('sign-in');
    button.disabled = true; button.textContent = 'Sending your link…';
    $('account-status').dataset.kind = 'pending';
    $('account-status').textContent = 'Sending a sign-in link. Please wait…';
    try {
      const { error } = await client.auth.signInWithOtp({ email: email.value.trim(), options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
      $('account-status').dataset.kind = 'success';
      $('account-status').textContent = 'Sign-in email sent. Check your inbox and spam folder.';
      $('email-success-copy').textContent = `We've sent a sign-in link to ${email.value.trim()}. Check your inbox and spam folder.`;
      dialog.close(); $('email-success').showModal();
      celebrate('', true);
    } catch (error) {
      $('account-status').dataset.kind = 'error';
      const message = String(error.message || '').toLowerCase();
      $('account-status').textContent = error.status === 429 || /rate|too many/.test(message)
        ? 'Too many requests. Please wait a few minutes before requesting another link.'
        : /not authorized|email_address_not_authorized/.test(message + error.code)
        ? 'Email delivery is currently limited to the project owner. Use your Supabase account email or ask the owner to enable email delivery for families.'
        : 'We could not send your email. Check the address and your internet connection, then try again.';
    } finally { button.disabled = false; button.textContent = 'Email me a sign-in link'; }
  });
  async function authChanged(session) {
    const next = session?.user || null;
    if (user?.id === next?.id && loaded) return;
    authVersion += 1; queue = []; user = next; loaded = false;
    closeReader(); family = null; activeChild = 'default'; account.state = ProgressModel.fresh(); render(); loadVoices();
    if (user) { await refresh(); if (loaded) celebrate('Welcome back!', true); }
    else { status('Sign in to save your reading across devices.'); $('account-status').textContent = 'Sign in with an email link—no password needed.'; }
  }
  window.addEventListener('focus', () => { if (!queue.length) void refresh(); });
  window.addEventListener('online', () => { if (queue.length) void drain(); else void refresh(); });
  window.addEventListener('beforeunload', (event) => { if (queue.length) { event.preventDefault(); event.returnValue = ''; } });
  render();
  async function init() {
    const config = window.BRIGHT_READS_CONFIG || {};
    if (!config.supabaseUrl || !config.supabasePublishableKey) {
      $('sign-in').disabled = true;
      $('account-status').textContent = 'Account sign-in is not connected yet. You can explore the stories, but progress will not be saved.';
      return;
    }
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js';
        script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
      });
      client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
      client.auth.onAuthStateChange((_event, session) => { setTimeout(() => void authChanged(session), 0); });
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      await authChanged(data.session);
      $('sign-in').disabled = false;
    } catch {
      $('sign-in').disabled = true;
      $('account-status').textContent = 'Could not connect to sign-in. Check your connection and reload this page.';
    }
  }
  void init();
})();
