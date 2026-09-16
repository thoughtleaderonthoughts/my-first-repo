/* Account synchronization uses an authenticated, atomic database RPC. */
(() => {
  const $ = (id) => document.getElementById(id);
  const dialog = $('account-dialog');
  let client = null, user = null, loaded = false, busy = false, queue = [];
  let authVersion = 0;
  const account = window.readingAccount = { state: ProgressModel.fresh(), record, preferences };
  function status(message) {
    $('sync-status').textContent = message;
    $('reader-save-status').textContent = message;
  }
  function render() {
    const state = account.state;
    $('reader-greeting').textContent = `HELLO, ${state.name.toUpperCase()}!`;
    $('open-profile').textContent = state.name.slice(0, 1).toUpperCase();
    $('reader-name').value = state.name;
    $('signed-in').hidden = !user;
    $('signed-out').hidden = Boolean(user);
    $('refresh-progress').disabled = !loaded;
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
    const { data, error } = await client.rpc('reading_account', { action: kind, payload });
    if (error) throw error;
    return data;
  }
  function apply(state) {
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
        queue.shift(); apply(data);
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
    } finally { busy = false; if (version !== authVersion && user && !loaded) void refresh(); }
  }
  function enqueue(kind, payload) {
    if (!loaded || !user) { status('Sign in and load your account to save progress.'); return; }
    queue.push({ kind, payload: { ...payload, generation: account.state.generation } });
    void drain();
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
      status('Fresh start! All progress and preferences have been reset.');
    } catch { $('account-status').textContent = 'Reset failed. Your saved data has not been cleared. Please retry.'; }
    finally { busy = false; $('reset-confirm').disabled = false; }
  });
  $('sign-out').addEventListener('click', async () => {
    if (busy || queue.length) { $('account-status').textContent = 'Please finish syncing using Refresh progress before signing out.'; return; }
    const { error } = await client.auth.signOut();
    if (error) $('account-status').textContent = 'Could not sign out. Please retry.';
  });
  $('sign-in').addEventListener('click', async () => {
    const email = $('account-email');
    if (!email.reportValidity()) return;
    $('sign-in').disabled = true;
    try {
      const { error } = await client.auth.signInWithOtp({ email: email.value.trim(), options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
      $('account-status').textContent = 'Check your email for a sign-in link. Open it on this device to continue.';
    } catch { $('account-status').textContent = 'Could not send the sign-in email. Check the address and try again shortly.'; }
    finally { $('sign-in').disabled = false; }
  });
  async function authChanged(session) {
    const next = session?.user || null;
    if (user?.id === next?.id && loaded) return;
    authVersion += 1; queue = []; user = next; loaded = false;
    closeReader(); account.state = ProgressModel.fresh(); render(); loadVoices();
    if (user) await refresh();
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
    } catch {
      $('sign-in').disabled = true;
      $('account-status').textContent = 'Could not connect to sign-in. Check your connection and reload this page.';
    }
  }
  void init();
})();
