import Phrase from "@/components/Phrase";
import { STORE } from "@/lib/store-info";

export default function AboutStore() {
  return (
    <div className="grid lg:grid-cols-[1fr_minmax(0,300px)] gap-12 lg:gap-16 items-start">

      <div className="max-w-2xl">
        <p className="text-xl md:text-2xl font-bold text-ink leading-relaxed tracking-tight">
          <Phrase>{"「オーセンティック + アルファ」"}</Phrase>
        </p>
        <div className="mt-8 space-y-6 text-ink-2 leading-loose">
          <p>
            <Phrase>{"シンプルで普遍的なデザインの古着と、トレンド感のある新品を中心に選定。"}</Phrase>
          </p>
          <p>
            <Phrase>{"ずっと好きなものと、今好きなものをバランス良くミックスし、変化する感性を表現する。それが私たちのセレクト基準です。"}</Phrase>
          </p>
          <p>
            <Phrase>{"洋服が軸にはありますが、場所（ハコ）の中に様々な物・人・感性が集まることで、コンセプトの変化を受け入れながら進んでいくことを是としています。"}</Phrase>
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-ink">取り扱いブランド</h3>
        <ul className="mt-4 space-y-2 text-sm text-ink-2 leading-relaxed">
          {STORE.brands.map((brand) => {
            const href = STORE.brandPages[brand];
            return (
              <li key={brand}>
                {href ? (
                  <a href={href} className="underline decoration-1 underline-offset-4 hover:decoration-2">{brand}</a>
                ) : (
                  brand
                )}
              </li>
            );
          })}
        </ul>

        <h3 className="text-lg font-bold text-ink mt-8">古着</h3>
        <ul className="mt-4 space-y-2 text-sm text-ink-2 leading-relaxed">
          <li><Phrase>{"アメリカ古着"}</Phrase></li>
          <li><Phrase>{"ヨーロッパ古着"}</Phrase></li>
          <li><Phrase>{"国内ドメブラ古着"}</Phrase></li>
        </ul>
      </div>
    </div>
  );
}
