/* Shared progress calculations. Only recognized words count. */
(function (root) {
  const fresh = () => ({ name: 'Reader', voice: '', rate: 0.82, books: {}, generation: 0 });
  function summary(state, catalog) {
    let completed = 0, pages = 0, words = 0, started = 0;
    for (const book of catalog) {
      const record = state.books[book.id];
      if (!record) continue;
      let bookWords = 0;
      book.pages.forEach((text, page) => {
        const total = text.split(' ').length;
        const count = Math.min(total, Math.max(0, Number(record.pages[page]) || 0));
        words += count; bookWords += count;
        if (count === total) pages += 1;
      });
      if (record.completedAt) completed += 1;
      else if (bookWords) started += 1;
    }
    return { completed, pages, words, started };
  }
  function resume(record, book) {
    if (!record || record.completedAt) return { page: 0, word: 0 };
    for (let page = 0; page < book.pages.length; page += 1) {
      const count = Number(record.pages[page]) || 0;
      if (count < book.pages[page].split(' ').length) return { page, word: count };
    }
    return { page: 0, word: 0 };
  }
  root.ProgressModel = { fresh, summary, resume };
  if (typeof module !== 'undefined') module.exports = root.ProgressModel;
})(typeof window === 'undefined' ? globalThis : window);
