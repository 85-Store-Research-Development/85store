import { cacheLife, cacheTag } from "next/cache";
import { CALENDAR_API_URL, DEFAULT_CALENDAR, jstNow, parseCalendarData, resolveDay, type CalendarData, type ResolvedDay } from "@/lib/business-calendar";

async function fetchCalendar(): Promise<CalendarData> {
  const response = await fetch(`${CALENDAR_API_URL}/v1/calendar`);
  if (!response.ok) throw new Error(`calendar API: ${response.status}`);
  const data = parseCalendarData(await response.json());
  if (!data) throw new Error("calendar API: invalid response");
  return data;
}

// 今後の臨時休業・営業時間の変更をサーバーで読む（クローラーや AI に見える文字と構造化データのため）。
// 画面のカレンダーはこれまでどおりブラウザで即時に反映し、こちらは1時間ごとに取り直す。
// 営業日の API は補助的な情報なので、失敗してもページを止めず、短くキャッシュして次で取り直す
export async function getUpcomingSpecialDays(days = 60): Promise<ResolvedDay[]> {
  "use cache";
  cacheTag("business-calendar");

  try {
    const data = await fetchCalendar();

    cacheLife("hours");
    const today = jstNow(new Date()).date;
    const end = new Date(`${today}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + days);
    const last = end.toISOString().slice(0, 10);

    return Object.keys(data.days)
      .filter((date) => date >= today && date < last)
      .sort()
      .map((date) => resolveDay(data, date));
  } catch (error) {
    console.error("営業日カレンダーを取得できませんでした", error);
    cacheLife("minutes");
    return [];
  }
}

// 指定した日（日本時間の YYYY-MM-DD）に店が開いているか（近くのイベントの日に合わせて案内するため）。過ぎた日は返さない。
// API が使えないときは通常の営業時間で答え、短くキャッシュして次で取り直す
export async function getStoreDays(dates: string[]): Promise<ResolvedDay[]> {
  "use cache";
  cacheTag("business-calendar");

  let data = DEFAULT_CALENDAR;
  try {
    data = await fetchCalendar();
    cacheLife("hours");
  } catch (error) {
    console.error("営業日カレンダーを取得できませんでした", error);
    cacheLife("minutes");
  }
  const today = jstNow(new Date()).date;
  return dates.filter((date) => date >= today).map((date) => resolveDay(data, date));
}
