// RSS フィードを読むための小さな道具（note・富山みっけで共有）

// <item> の中身を順に取り出す
export function rssItems(xml: string): string[] {
  return Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g), (match) => match[1]);
}

// XMLタグの内容を抽出
export function extractTag(content: string, tagName: string): string | undefined {
  // CDATAセクションを含むパターン
  const cdataRegex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`, "i");
  const cdataMatch = content.match(cdataRegex);
  if (cdataMatch) {
    return cdataMatch[1].trim();
  }

  // 通常のタグパターン
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = content.match(regex);
  return match ? match[1].trim() : undefined;
}

// 同じ名前のタグをすべて抽出（<category> など）
export function extractTags(content: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tagName}>`, "gi");
  return Array.from(content.matchAll(regex), (match) => decodeHtmlEntities(match[1].trim()));
}

// RSSの日付（RFC 822形式）をISO形式に変換する（パースできなければ現在時刻）
export function toIsoDate(pubDate: string | undefined): string {
  const date = pubDate ? new Date(pubDate) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

// HTMLエンティティをデコード
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

// descriptionをクリーンアップ（タグを除き、長ければ切り詰める）
export function cleanDescription(description: string, maxLength = 150): string {
  // HTMLタグを削除
  let text = description.replace(/<[^>]*>/g, "");
  // HTMLエンティティをデコード
  text = decodeHtmlEntities(text);
  // 空白を正規化
  text = text.replace(/\s+/g, " ").trim();
  // 長すぎる場合は切り詰め
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + "...";
  }
  return text;
}
