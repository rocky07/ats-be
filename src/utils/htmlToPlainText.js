// Convert rich-text (Quill-generated) HTML into readable plain text for channels
// that don't render HTML, e.g. LinkedIn UGC posts.
export const htmlToPlainText = (html = '') => {
    if (!html) return '';
    return html
        .replace(/<li[^>]*>/gi, '• ')
        .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};
