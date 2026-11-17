// note.com RSSフィードから記事を取得
import { cacheLife, cacheTag } from "next/cache";
import { cleanDescription, decodeHtmlEntities, extractTag, rssItems, toIsoDate } from "@/lib/rss";

export interface NoteArticle {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  thumbnail?: string;
  excerpt?: string;
}

// RSSフィードをパースして記事を取得（1時間キャッシュ）
// noteは補助的なコンテンツなので、取得に失敗してもビルドやページを止めず、
// 空配列を数分だけキャッシュして次の取得を早めに試す
export async function getNoteArticles(): Promise<NoteArticle[]> {
  "use cache";
  cacheTag("note");

  try {
    const response = await fetch("https://note.com/85_store/rss");
    if (!response.ok) {
      throw new Error(`Failed to fetch note RSS feed: ${response.status}`);
    }
    const articles = parseRssFeed(await response.text());
    cacheLife("hours");
    return articles;
  } catch (error) {
    console.error("Error fetching note articles:", error);
    cacheLife("minutes");
    return [];
  }
}

// XMLをパースして記事情報を抽出
function parseRssFeed(xml: string): NoteArticle[] {
  const articles: NoteArticle[] = [];

  for (const itemContent of rssItems(xml)) {
    // 各フィールドを抽出
    const title = extractTag(itemContent, "title");
    const link = extractTag(itemContent, "link");
    const pubDate = extractTag(itemContent, "pubDate");
    const description = extractTag(itemContent, "description");

    // media:thumbnailまたはenclosureからサムネイルを取得
    const thumbnail = extractMediaThumbnail(itemContent) || extractEnclosureUrl(itemContent);

    if (title && link) {
      // URLからIDを生成
      const id = link.split("/").pop() || link;

      articles.push({
        id: `note-${id}`,
        title: decodeHtmlEntities(title),
        url: link,
        publishedAt: toIsoDate(pubDate),
        thumbnail,
        excerpt: description ? cleanDescription(description) : undefined,
      });
    }
  }

  return articles;
}

// media:thumbnailの内容またはURL属性を抽出
function extractMediaThumbnail(content: string): string | undefined {
  // まず閉じタグがある形式を試す: <media:thumbnail>URL</media:thumbnail>
  const contentRegex = /<media:thumbnail[^>]*>([^<]+)<\/media:thumbnail>/i;
  const contentMatch = content.match(contentRegex);
  if (contentMatch) {
    return contentMatch[1].trim();
  }

  // URL属性形式も試す: <media:thumbnail url="..."/>
  const attrRegex = /<media:thumbnail[^>]*url=["']([^"']+)["'][^>]*\/?>/i;
  const attrMatch = content.match(attrRegex);
  return attrMatch ? attrMatch[1] : undefined;
}

// enclosureのURL属性を抽出
function extractEnclosureUrl(content: string): string | undefined {
  const regex = /<enclosure[^>]*url=["']([^"']+)["'][^>]*\/?>/i;
  const match = content.match(regex);
  return match ? match[1] : undefined;
}
