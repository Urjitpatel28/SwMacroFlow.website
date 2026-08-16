/* Supabase coordinates for the reviews section on index.html.
 *
 * Both values are meant to be public - the publishable key is what every visitor's browser uses to
 * read reviews. What actually protects the data is the row level security set up on the database:
 * anonymous callers may SELECT from public.reviews and may EXECUTE public.submit_review, and that
 * is all. They cannot INSERT directly, cannot UPDATE, and cannot DELETE. Never put a service_role
 * key in this file; that one bypasses row level security entirely.
 *
 * Until both fields are filled in, assets/reviews.js leaves the whole section hidden rather than
 * showing a review box that cannot reach its data. */
window.SwReviewConfig = {
  url: 'https://xvgfdosvwiwkdsgqvhnu.supabase.co',
  key: 'sb_publishable_XrfMoseFlwcLfigI84xlBg_hRVF1Wk_'
};
