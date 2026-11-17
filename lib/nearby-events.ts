// 85-Store の近く（車で20分圏内）と、少し足をのばした先（小矢部・高岡）のイベント。富山のおでかけ情報サイト「富山みっけ」のフィードから読む
import { cacheLife, cacheTag } from "next/cache";
import { jstNow } from "@/lib/business-calendar";
import { cleanDescription, decodeHtmlEntities, extractTag, extractTags, rssItems, toIsoDate } from "@/lib/rss";

// 富山みっけ編集部から、RSS を使って記事へのリンクを載せる許諾をもらっている（2026-11-13、メール）。
// 許諾の範囲は「記事へのリンク付きの紹介」。画像や本文を載せるときは、あらためて相談する
export const EVENT_SOURCE = {
  name: "富山みっけ",
  url: "https://toyamamikke.com/",
  description: "富山の新店・閉店・おでかけ情報サイト",
} as const;

// 「イベント」と市のタグが両方付いた記事のフィード（WordPress は tag/a+b で両方を満たす記事を返す）
const FEEDS = ["nanto", "tonami", "oyabe", "takaoka"].map((city) => `${EVENT_SOURCE.url}tag/event+${city}/feed/`);
// フィードは1ページ10件。過去のイベントも載せるので、続きのページ（?paged=2…）もここまで読む
const FEED_PAGE_SIZE = 10;
const MAX_FEED_PAGES = 5;
const EVENT_TAG = "イベント";

// 85-Store（井波）から車でおよそ何分か。題名と要約に地区名か会場名があれば、その地区のイベントとして扱う。
// 上から順に調べる（庄川は砺波市なので砺波より先）。分数は道のりからの目安
const AREAS: { name: string; minutes: number; keywords: string[] }[] = [
  { name: "井波", minutes: 5, keywords: ["井波", "いなみ", "瑞泉寺", "閑乗寺"] },
  { name: "庄川", minutes: 10, keywords: ["庄川"] },
  { name: "福野", minutes: 10, keywords: ["福野", "ヘリオス", "ア・ミュー"] },
  { name: "井口", minutes: 10, keywords: ["井口"] },
  { name: "城端", minutes: 15, keywords: ["城端", "じょうはな", "桜ヶ池"] },
  { name: "砺波", minutes: 15, keywords: ["砺波", "となみ", "チューリップ"] },
  { name: "福光", minutes: 20, keywords: ["福光", "イオックス", "IOX"] },
];
// 地区名が無いときは、記事に付いた市のタグで決める（南砺市は広いので、地区が分からなければ載せない）
const CITY_AREAS: Record<string, { name: string; minutes: number }> = {
  砺波市: { name: "砺波", minutes: 15 },
  小矢部市: { name: "小矢部", minutes: 30 },
  高岡市: { name: "高岡", minutes: 40 },
};
// 「近く」とみなす分数
export const NEAR_MINUTES = 20;
// 出かける催しではない記事（放送・配信・商品券・写真の募集）は載せない
const NOT_VISIT_KEYWORDS = ["放送", "YouTube", "商品券", "フォトコンテスト"];
// 同じ南砺市でも山あいは40分以上かかるので載せない
const FAR_KEYWORDS = ["利賀", "TOGA", "五箇山", "相倉", "菅沼", "上平", "平村", "上梨"];

// 日程が読み取れない記事・終わりの日が分からない催しを載せておく日数
const FALLBACK_DAYS = 30;
// 開催日を1日ずつ並べる上限（これより長い催しは期間で表す）
const MAX_LISTED_DAYS = 3;

export interface NearbyEvent {
  id: string;
  title: string; // 記事の題名（｜より前）
  note?: string; // 題名の｜より後ろ（見どころ）
  url: string;
  summary?: string;
  publishedAt: string;
  area: { name: string; minutes: number };
  start?: string; // 日本時間の YYYY-MM-DD（「〜まで」の催しは無い）
  end?: string; // （「〜から」の催しは無い）
  days: string[]; // 開催日（3日以内のときだけ）
  ongoing: boolean; // 開催中（今日が期間の中）
  past: boolean; // 終わった催し
}

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const toDate = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

// 題名の日付（「11月14日・15日」「11月15日〜1月6日」「11月28日まで」「11月14日から」）を読む。
// 年は書かれていないことが多いので、記事の公開日より後で最も近い日とみなす
export function parseEventDates(text: string, publishedDate: string): Pick<NearbyEvent, "start" | "end" | "days"> {
  // 曜日のかっこを外す（「21日（土）・22日（日）」→「21日・22日」）
  const source = text.replace(/[（(][月火水木金土日][・祝]*[）)]/g, "");
  const found: { date: string; range: boolean; index: number; length: number }[] = [];
  // 公開の少し前に始まった催しもあるので、2か月前までは同じ年とみなす
  let floor = addDays(publishedDate, -60);
  let year = Number(publishedDate.slice(0, 4));
  let month: number | undefined;
  let lastEnd = 0;

  for (const match of source.matchAll(/(?:(\d{4})年)?(?:(\d{1,2})月)?(\d{1,2})日/g)) {
    const between = source.slice(lastEnd, match.index);
    // 月の無い「15日」は、直前の日付に続くときだけ（「・15日」「〜15日」）
    if (!match[2] && (month === undefined || !/^[・、,〜～~\-－ー]$/.test(between.trim()))) continue;
    if (match[1]) year = Number(match[1]);
    if (match[2]) month = Number(match[2]);
    let date = toDate(year, month!, Number(match[3]));
    if (!match[1] && date < floor) date = toDate(++year, month!, Number(match[3]));
    floor = date;
    found.push({ date, range: found.length > 0 && /[〜～~]|から/.test(between), index: match.index, length: match[0].length });
    lastEnd = match.index + match[0].length;
  }
  if (found.length === 0) return { days: [] };

  const first = found[0];
  const last = found[found.length - 1];
  if (found.length === 1) {
    const after = source.slice(first.index + first.length, first.index + first.length + 4);
    if (/^(まで|必着|締)/.test(after)) return { end: first.date, days: [] };
    if (/^(から|より|〜|～)/.test(after)) return { start: first.date, days: [first.date] };
    return { start: first.date, end: first.date, days: [first.date] };
  }

  // 期間（〜）は間の日も開催日。3日以内なら1日ずつ並べる
  const days = new Set<string>();
  for (const [i, item] of found.entries()) {
    if (item.range) {
      for (let d = found[i - 1].date; d < item.date && days.size <= MAX_LISTED_DAYS; d = addDays(d, 1)) days.add(d);
    }
    days.add(item.date);
  }
  return { start: first.date, end: last.date, days: days.size <= MAX_LISTED_DAYS ? [...days].sort() : [] };
}

function areaOf(text: string, categories: string[]): NearbyEvent["area"] | undefined {
  // 小矢部・高岡の記事は、文中に近くの地名が出てきても会場はその市
  const city = categories.find((category) => CITY_AREAS[category]?.minutes > NEAR_MINUTES);
  if (city) return CITY_AREAS[city];
  const area = AREAS.find(({ keywords }) => keywords.some((keyword) => text.includes(keyword)));
  if (area) return { name: area.name, minutes: area.minutes };
  const fallback = categories.find((category) => CITY_AREAS[category]);
  return fallback ? CITY_AREAS[fallback] : undefined;
}

// フィードの1件をイベントにする（イベントでない記事・20分圏外・地区が分からない記事は undefined）
function toEvent(item: string): Omit<NearbyEvent, "ongoing" | "past"> | undefined {
  const rawTitle = extractTag(item, "title");
  const url = extractTag(item, "link");
  const categories = extractTags(item, "category");
  if (!rawTitle || !url || !categories.includes(EVENT_TAG)) return undefined;

  // 題名の末尾の【砺波市】は地区の表示と重なるので外す
  const fullTitle = decodeHtmlEntities(rawTitle).replace(/【[^】]*】\s*$/, "").trim();
  const [title, ...rest] = fullTitle.split("｜");
  const description = extractTag(item, "description");
  const summary = description ? cleanDescription(description, 120) : undefined;

  // 題名（｜より前）で判定する。見どころや要約には「五箇山に伝わる」「フォトコンテストも」のような言及があるため
  if ([...NOT_VISIT_KEYWORDS, ...FAR_KEYWORDS].some((keyword) => title.includes(keyword))) return undefined;
  const area = areaOf(`${fullTitle} ${summary ?? ""}`, categories);
  if (!area) return undefined;

  const publishedAt = toIsoDate(extractTag(item, "pubDate"));
  const publishedDate = jstNow(new Date(publishedAt)).date;
  // 題名の｜より前に日程が書かれている。無ければ題名全体、要約の順に探す
  let dates = parseEventDates(title, publishedDate);
  if (!dates.start && !dates.end) dates = parseEventDates(fullTitle, publishedDate);
  if (!dates.start && !dates.end && summary) dates = parseEventDates(summary, publishedDate);

  return { id: url, title: title.trim(), note: rest.join("｜").trim() || undefined, url, summary, publishedAt, area, ...dates };
}

// いつまで「これから」に載せるか（終わりの日。分からなければ始まり・公開から30日）
function lastShownDate(event: Pick<NearbyEvent, "start" | "end">, publishedDate: string): string {
  return event.end ?? addDays(event.start ?? publishedDate, FALLBACK_DAYS);
}

// フィードを続きのページまで読む（最後のページの次は 404）
async function fetchFeedItems(feed: string): Promise<string[]> {
  const items: string[] = [];
  for (let page = 1; page <= MAX_FEED_PAGES; page++) {
    const response = await fetch(page === 1 ? feed : `${feed}?paged=${page}`);
    if (page > 1 && response.status === 404) break;
    if (!response.ok) throw new Error(`Failed to fetch ${feed}: ${response.status}`);
    const pageItems = rssItems(await response.text());
    items.push(...pageItems);
    if (pageItems.length < FEED_PAGE_SIZE) break;
  }
  return items;
}

// イベントの一覧。これからの催しは開催日の近い順、終わった催しは新しい順で後ろに並べる。1時間ごとに取り直す。
// 補助的な情報なので、取得に失敗してもページを止めず、空の一覧を数分だけキャッシュする
export async function getNearbyEvents(): Promise<NearbyEvent[]> {
  "use cache";
  cacheTag("nearby-events");

  try {
    const items = (await Promise.all(FEEDS.map(fetchFeedItems))).flat();
    cacheLife("hours");

    const today = jstNow(new Date()).date;
    const events = new Map<string, NearbyEvent>();
    for (const item of items) {
      const event = toEvent(item);
      if (!event) continue;
      const past = lastShownDate(event, jstNow(new Date(event.publishedAt)).date) < today;
      // 始まりの分からない「〜まで」の催しは、終わるまで開催中とみなす
      const ongoing = event.end !== undefined && (event.start ?? today) <= today && today <= event.end;
      events.set(event.id, { ...event, ongoing, past });
    }
    // 開催中のもの（始まりが今日より前・「〜まで」）は今日の催しとして並べる
    const upcomingKey = (event: NearbyEvent) => {
      const start = event.start ?? today;
      return start < today ? today : start;
    };
    const pastKey = (event: NearbyEvent) => event.end ?? event.start ?? jstNow(new Date(event.publishedAt)).date;
    const all = [...events.values()];
    return [
      ...all.filter((event) => !event.past).sort((a, b) => upcomingKey(a).localeCompare(upcomingKey(b)) || a.title.localeCompare(b.title, "ja")),
      ...all.filter((event) => event.past).sort((a, b) => pastKey(b).localeCompare(pastKey(a))),
    ];
  } catch (error) {
    console.error("Error fetching nearby events:", error);
    cacheLife("minutes");
    return [];
  }
}
