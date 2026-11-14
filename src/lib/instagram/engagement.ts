/** Engagement ranking for auto-featuring (pure, unit-tested). Comments signal more interest than likes. */
export interface EngagementRow {
  articleId: string;
  likes: number;
  comments: number;
  postedAt: string;
}

export function engagementScore(likes: number, comments: number): number {
  return likes + 3 * comments;
}

/** The top `n` stories posted within the last `days`, best first (ties: newer first). */
export function topByEngagement(rows: EngagementRow[], now = new Date(), n = 4, days = 7): string[] {
  const since = now.getTime() - days * 864e5;
  return rows
    .filter((r) => {
      const t = new Date(r.postedAt).getTime();
      return t >= since && t <= now.getTime() && engagementScore(r.likes, r.comments) > 0;
    })
    .sort((a, b) => engagementScore(b.likes, b.comments) - engagementScore(a.likes, a.comments) || +new Date(b.postedAt) - +new Date(a.postedAt))
    .slice(0, n)
    .map((r) => r.articleId);
}
