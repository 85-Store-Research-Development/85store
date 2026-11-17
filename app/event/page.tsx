import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import BlogCard, { BlogCardGrid } from "@/components/BlogCard";
import IrregularHolidayNote from "@/components/IrregularHolidayNote";
import ParkingNote from "@/components/ParkingNote";
import Phrase from "@/components/Phrase";
import SectionHeading from "@/components/SectionHeading";
import StoreActions from "@/components/StoreActions";
import { weekdayOf, type ResolvedDay } from "@/lib/business-calendar";
import { getStoreDays } from "@/lib/business-calendar-server";
import { getBlogPostsByCategories } from "@/lib/cms";
import { pageAlternates } from "@/lib/metadata";
import { EVENT_SOURCE, NEAR_MINUTES, getNearbyEvents, type NearbyEvent } from "@/lib/nearby-events";
import { SHORT_TEXT_LENGTH } from "@/lib/phrase";
import { STORE, STORE_FULL_ADDRESS } from "@/lib/store-info";
import { getBlogSection, getBlogSectionPath } from "@/utils/blog";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://85-store.com";
const description =
  "85-Store（富山県南砺市井波）から車で20分圏内のイベント情報。井波・庄川・福野・城端・福光・砺波のマルシェやお祭りと、その日の 85-Store の営業時間をまとめています。小矢部・高岡のイベントと、これまでのイベントも載せています。";

export const metadata: Metadata = {
  title: "Event（近くのイベント）",
  description,
  alternates: pageAlternates("/event"),
  openGraph: { type: "website", locale: "ja_JP", url: `${siteUrl}/event`, title: "Event（近くのイベント）", description },
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// 「11月21日（土）」。前の日と同じ月なら月を省く。終わった催しは年も付ける
function dayLabel(date: string, previous?: string, withYear = false): string {
  const [year, month, day] = date.split("-").map(Number);
  const sameMonth = previous?.slice(0, 7) === date.slice(0, 7);
  return `${withYear && !previous ? `${year}年` : ""}${sameMonth ? "" : `${month}月`}${day}日（${WEEKDAYS[weekdayOf(date)]}）`;
}

// 開催日の表示
function dateLabel(event: NearbyEvent): string {
  const first = (date: string) => dayLabel(date, undefined, event.past);
  if (event.days.length > 0 && event.end) return event.days.map((day, i) => dayLabel(day, event.days[i - 1], event.past)).join("・");
  if (event.start && event.end) return `${first(event.start)}〜${dayLabel(event.end, event.start.slice(0, 7) === event.end.slice(0, 7) ? event.start : undefined)}`;
  if (event.start) return `${first(event.start)}から`;
  if (event.end) return `${first(event.end)}まで`;
  return event.past ? "" : "日程は記事でご確認ください";
}

const drive = (event: NearbyEvent) => (
  <span className="chip">85-Store から車で約<span className="num">{event.area.minutes}</span>分</span>
);

// これからのイベントの一覧（開催日の 85-Store の営業時間つき）
function EventList({ events, storeDays }: { events: NearbyEvent[]; storeDays: Map<string, ResolvedDay> }) {
  return (
    <ul>
      {events.map((event) => {
        const days = event.days.flatMap((date) => storeDays.get(date) ?? []);
        return (
          <li key={event.id} className="grid grid-cols-12 gap-x-8 gap-y-4 border-b border-rule py-8">
            <div className="col-span-4 grid content-start justify-items-start gap-3 max-[900px]:col-span-12">
              <p className="text-xl font-semibold leading-snug">
                {event.start && <time dateTime={event.start} className="sr-only">{event.start}</time>}
                <span className="num"><Phrase>{dateLabel(event)}</Phrase></span>
              </p>
              <p className="flex flex-wrap gap-2">
                {event.ongoing && <span className="status is-open">開催中</span>}
                <span className="chip">{event.area.name}</span>
                {drive(event)}
              </p>
            </div>
            <div className="col-span-8 grid content-start gap-3 max-[900px]:col-span-12">
              <h3 className="text-lg leading-normal">
                <a href={event.url} target="_blank" rel="noopener noreferrer" className="hover:underline hover:decoration-1 hover:underline-offset-[5px]">
                  <Phrase>{event.title}</Phrase>
                  <span className="sr-only">{`（${EVENT_SOURCE.name}で開きます）`}</span>
                </a>
              </h3>
              {event.note && <p className="text-ink-2"><Phrase max={SHORT_TEXT_LENGTH}>{event.note}</Phrase></p>}
              {event.summary && <p className="text-sm text-muted">{event.summary}</p>}
              {days.length > 0 && (
                <div className="bg-surface p-4 text-sm">
                  <p className="font-semibold"><Phrase>{"この日の 85-Store"}</Phrase></p>
                  <ul className="mt-1 grid gap-1">
                    {days.map((day, i) => <StoreDay key={day.date} day={day} previous={days[i - 1]?.date} />)}
                  </ul>
                </div>
              )}
              <p className="text-sm">
                <a href={event.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                  {`${EVENT_SOURCE.name}で詳しく見る`}
                </a>
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const SourceNote = () => (
  <p className="mt-4 max-w-[48em] text-sm text-muted">
    {"出典："}
    <a href={EVENT_SOURCE.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{EVENT_SOURCE.name}</a>
    {`（${EVENT_SOURCE.description}）。${EVENT_SOURCE.name}編集部の許諾をいただき、RSS フィードから記事へのリンクを掲載しています。日時や内容は変わることがあります。お出かけの前に、リンク先の記事と主催者の案内をご確認ください。車での所要時間は目安です。`}
  </p>
);

// その日の 85-Store の営業
function StoreDay({ day, previous }: { day: ResolvedDay; previous?: string }) {
  return (
    <li>
      <time dateTime={day.date} className="num">{dayLabel(day.date, previous)}</time>
      {"　"}
      {!day.closed ? (
        <><span className="num">{day.opens}〜{day.closes}</span> に営業</>
      ) : day.regularClosed ? (
        <>定休日（<Link href="/reserve" className="underline underline-offset-4">事前予約</Link>で開けられます）</>
      ) : (
        "臨時休業"
      )}
    </li>
  );
}

export default async function EventPage() {
  const eventSection = getBlogSection("event");
  const [events, storeEvents] = await Promise.all([
    getNearbyEvents(),
    getBlogPostsByCategories(eventSection.categories),
  ]);
  const upcoming = events.filter((event) => !event.past);
  const near = upcoming.filter((event) => event.area.minutes <= NEAR_MINUTES);
  const further = upcoming.filter((event) => event.area.minutes > NEAR_MINUTES);
  const past = events.filter((event) => event.past);
  // イベントの日に店が開いているか
  const dates = [...new Set(upcoming.flatMap((event) => event.days))].sort();
  const storeDays = new Map((await getStoreDays(dates)).map((day) => [day.date, day]));

  return (
    <div className="wrap pt-12">
      <SectionHeading as="h1" title="Event" description="85-Store から車で20分圏内のイベント" />
      <p className="max-w-[40em] text-ink-2">
        {"井波・庄川・福野・城端・福光・砺波で開かれるイベントを、富山のおでかけ情報サイト「"}
        <a href={EVENT_SOURCE.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{EVENT_SOURCE.name}</a>
        {"」の記事から、編集部の許諾をいただいて紹介します。どの会場も 85-Store から車で20分ほど。お出かけの行き帰りに、井波の町歩きとあわせてお立ち寄りください。"}
      </p>

      <section className="section" aria-labelledby="nearby-heading">
        <SectionHeading id="nearby-heading" title="Nearby" description="これからの近くのイベント" />
        {near.length === 0 ? (
          <p className="border-y border-rule py-8 text-ink-2">
            <Phrase max={SHORT_TEXT_LENGTH}>{"いま紹介できる近くのイベントはありません。新しいイベントが見つかりしだい、ここに載せます。"}</Phrase>
          </p>
        ) : (
          <EventList events={near} storeDays={storeDays} />
        )}
        <SourceNote />
      </section>

      {further.length > 0 && (
        <section className="section" aria-labelledby="further-heading">
          <SectionHeading id="further-heading" title="A Little Further" description="少し足をのばして、小矢部・高岡のイベント" />
          <EventList events={further} storeDays={storeDays} />
          <SourceNote />
        </section>
      )}

      <section className="section" aria-labelledby="stop-by-heading">
        <SectionHeading id="stop-by-heading" title="Stop by" description="イベントのついでに 85-Store へ" />
        <div className="grid-lines grid-cols-12">
          <figure className="relative col-span-5 min-h-72 bg-surface max-[900px]:col-span-12 max-[900px]:aspect-[3/2] max-[900px]:min-h-0">
            <Image src="/images/shop.jpg" alt="85-Store の店内" fill sizes="(max-width: 900px) 100vw, 40vw" className="object-cover" />
          </figure>
          <div className="col-span-7 grid content-between gap-6 p-[clamp(20px,3vw,40px)] max-[900px]:col-span-12">
            <div>
              <p className="mb-4 text-ink-2">
                <Phrase max={SHORT_TEXT_LENGTH}>{"井波の古着・セレクトショップです。午前のイベントのあとでも、18時まで開いています。"}</Phrase>
              </p>
              <dl className="facts">
                <div>
                  <dt><Phrase>{"営業時間"}</Phrase></dt>
                  <dd>
                    <span className="num">{STORE.hours.label}</span>（{STORE.hours.closedLabel}）
                    <span className="block text-sm text-muted"><Phrase max={SHORT_TEXT_LENGTH}>{STORE.hours.note}</Phrase></span>
                    <IrregularHolidayNote className="text-muted" />
                  </dd>
                </div>
                <div><dt><Phrase>{"住所"}</Phrase></dt><dd>{STORE_FULL_ADDRESS}</dd></div>
                <div><dt><Phrase>{"駐車場"}</Phrase></dt><dd><ParkingNote /></dd></div>
              </dl>
            </div>
            <StoreActions
              showOnlineStore={false}
              leading={<Link href="/reserve" className="btn btn-primary"><Phrase>{"営業日を確認・来店予約"}</Phrase></Link>}
            />
          </div>
        </div>
      </section>

      {storeEvents.length > 0 && (
        <section className="section" aria-labelledby="store-events-heading">
          <SectionHeading
            id="store-events-heading"
            title="At 85-Store"
            description="85-Store のイベント"
            link={{ href: getBlogSectionPath(eventSection), label: "すべて見る" }}
          />
          <BlogCardGrid>
            {storeEvents.slice(0, 3).map((post) => <BlogCard key={post.id} post={post} />)}
          </BlogCardGrid>
        </section>
      )}
      {past.length > 0 && (
        <section className="section" aria-labelledby="past-heading">
          <SectionHeading id="past-heading" title="Past" description="これまでのイベント" />
          <ul>
            {past.map((event) => (
              <li key={event.id} className="grid grid-cols-12 items-baseline gap-x-8 gap-y-1 border-b border-rule py-4">
                <p className="col-span-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted max-[900px]:col-span-12">
                  {event.start && <time dateTime={event.start} className="sr-only">{event.start}</time>}
                  <span className="num">{dateLabel(event)}</span>
                  <span className="chip">{event.area.name}</span>
                </p>
                <p className="col-span-8 max-[900px]:col-span-12">
                  <a href={event.url} target="_blank" rel="noopener noreferrer" className="hover:underline hover:decoration-1 hover:underline-offset-[5px]">
                    <Phrase>{event.title}</Phrase>
                    <span className="sr-only">{`（${EVENT_SOURCE.name}で開きます）`}</span>
                  </a>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}
