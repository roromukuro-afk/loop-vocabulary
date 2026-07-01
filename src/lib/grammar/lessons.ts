import type { Lesson } from "./types";

// 冠詞レッスン（Notion: 中学英語攻略本#1 + 英文から考える英文法#1 + ポラリス#23 を横断統合）
const kanshi: Lesson = {
  slug: "kanshi-a-an-the",
  levelKey: "chugaku",
  order: 1,
  shortTitle: "冠詞",
  title: "冠詞 a / an / the の使い分け",
  metaTitle: "冠詞 a / an / the の使い分け【共通認識で理解する英文法】",
  description:
    "a・an・the の違いを「共通認識」という1つの軸で理解。天体・方角の the、最初は a→2回目は the、a と an の音の使い分け、無冠詞のパターンまで例文付きで解説。確認問題あり。",
  keywords: "冠詞, a an the 使い分け, the 使い方, a an 違い, 英文法 冠詞, 中学英語 冠詞",
  heroLead: "a・an・the を「訳」ではなく「名詞の見え方」でとらえる。1つの軸で全部つながる。",
  readTime: "8分",
  sections: [
    {
      heading: "冠詞の核心は「共通認識できるか」",
      blocks: [
        {
          type: "p",
          text: "冠詞（a / an / the）は名詞の前に置く小さな目印で、その名詞を「どう見ているか」を示す。日本語にぴったり対応する言葉がないため、訳で覚えようとすると必ず迷う。大切なのは訳すことではなく、英語が名詞をどう扱っているかを読むことだ。",
        },
        {
          type: "callout",
          tone: "key",
          title: "この単元の1本の軸",
          text: "the＝話し手と聞き手が「あれだ」と同じものを思い浮かべられる（共通認識）。a / an＝共通認識できない、たくさんある中の1つ。天体・方角・既出・場面の the も、すべてこの1つの発想に集約できる。",
        },
        {
          type: "table",
          headers: ["冠詞", "基本イメージ", "ざっくりの意味", "例"],
          rows: [
            ["the", "話し手と聞き手で共有できる", "その・例の・みんながわかるもの", "the sun / the door"],
            ["a / an", "たくさんある中の1つ", "1つの・ある・どれか1つ", "a watch / an idea"],
            ["無冠詞", "種類・活動・手段として見る", "—", "play soccer / by train"],
          ],
        },
      ],
    },
    {
      heading: "定冠詞 the：共通認識のサイン",
      blocks: [
        {
          type: "p",
          text: "the の中心イメージは「共通認識」。話し手と聞き手の両方が、どれを指しているかわかるときに使う。「天体には the」「方角には the」という別々のルールに見えるものも、すべて『全員が同じものを指せるから the』で説明できる。",
        },
        {
          type: "example",
          en: "I want to go to the moon someday.",
          jp: "いつか月に行きたい。",
          point: "moon は誰もが同じ「月」を思い浮かべられる。だから the moon。「天体だから」と丸暗記するより応用が利く。",
        },
        {
          type: "example",
          en: "The sun rises in the east.",
          jp: "太陽は東から昇る。",
          point: "the sun も the east も、全員が同じものを指せる。「どの東？」と迷う人はいない＝共通認識。",
        },
        {
          type: "callout",
          tone: "tip",
          title: "読解で見るサイン",
          text: "the + 名詞 が出てきたら、「すでに出てきたもの」か「文脈・常識でどれかわかるもの」。長文では前の文に同じ名詞や言い換えがないか確認する。",
        },
      ],
    },
    {
      heading: "「最初は a、2回目は the」と、その落とし穴",
      blocks: [
        {
          type: "p",
          text: "基本パターンとして、初めて出す名詞には a / an、2回目以降に同じものを指すときは the が使われやすい。これは『最初はまだ共有できない→2回目は共有できる』という流れで理解する。",
        },
        {
          type: "example",
          en: "Yuna bought a new watch. The watch looks expensive.",
          jp: "ユナは新しい時計を買った。その時計は高そうだ。",
          point: "1文目の a new watch は聞き手にとって未特定。2文目はもう共有できるので the watch。",
        },
        {
          type: "callout",
          tone: "warn",
          title: "「2回目だから the」は誤り",
          text: "判断軸は順番ではなく「共通認識できるか」。初めて出す名詞でも、その場面でどれを指すか分かれば the になる。",
        },
        {
          type: "example",
          en: "Please close the door.",
          jp: "ドアを閉めてください。",
          point: "部屋でドアと言えば普通その部屋のドア。前に出ていなくても共有できるので the door。",
        },
        {
          type: "example",
          en: "Did you hear the news?",
          jp: "あのニュース聞いた？",
          point: "話し手が「相手も例のニュースを共有できる」と思えば the news。",
        },
      ],
    },
    {
      heading: "不定冠詞 a：たくさんある中の1つ",
      blocks: [
        {
          type: "p",
          text: "a / an の中心イメージは「たくさんある中の1つ」。the の裏返しで、共通認識できない・正体不明なものにつける。数えられる名詞が単数で、まだ特定されていないときに使う。",
        },
        {
          type: "example",
          en: "I'm a stay-at-home dad.",
          jp: "私は専業主夫です。",
          point: "世の中に複数いる専業主夫のうちの1人。職業・立場の単数名詞には a / an がつきやすい。",
        },
        {
          type: "example",
          en: "Have you ever seen a sea turtle?",
          jp: "ウミガメを見たことがありますか。",
          point: "「どのウミガメでもいいから1匹」という感覚。a は『どれでもいい1つ／種類のどれか』にも広がる。",
        },
        {
          type: "table",
          headers: ["a の感覚", "例", "意味"],
          rows: [
            ["1つの", "a cup of coffee", "コーヒー1杯"],
            ["〜につき", "once a week", "週に1回（per の意味）"],
            ["ある・とある", "a certain day", "ある日（特定しない1つ）"],
          ],
        },
      ],
    },
    {
      heading: "a と an は「文字」ではなく「音」で決まる",
      blocks: [
        {
          type: "p",
          text: "母音の音で始まる語の前では an、子音の音で始まる語の前では a。判断するのは綴り（文字）ではなく発音。しかも見るのは名詞ではなく『直後の語』だ。",
        },
        {
          type: "table",
          headers: ["形", "条件", "例", "理由"],
          rows: [
            ["a", "子音の音で始まる", "a dog / a UFO", "UFO は「ユー」という子音の音"],
            ["an", "母音の音で始まる", "an apple / an hour", "hour は h を発音せず母音の音"],
          ],
        },
        {
          type: "example",
          en: "That's an interesting idea. / That's a famous idea.",
          jp: "それは面白い考えだ。／それは有名な考えだ。",
          point: "an / a を決めるのは idea ではなく直後の語。interesting は母音の音→an、famous は子音の音→a。",
        },
        {
          type: "callout",
          tone: "warn",
          title: "入試で狙われる",
          text: "an hour（h を発音しない＝母音の音）／a university（「ユ」＝子音の音）。文字が母音かどうかではなく、発音が母音で始まるかを見る。",
        },
      ],
    },
    {
      heading: "冠詞をつけない（無冠詞）パターン",
      blocks: [
        {
          type: "p",
          text: "すべての名詞に a / an / the がつくわけではない。名詞を『1つの具体物』ではなく『種類・活動・手段』として扱うときは無冠詞になりやすい。",
        },
        {
          type: "table",
          headers: ["無冠詞になる場面", "例", "理由"],
          rows: [
            ["複数名詞を一般的に言う", "Cats are popular pets.", "猫全体について話している"],
            ["スポーツ", "I play soccer.", "競技名として扱う"],
            ["食事", "I had lunch.", "食事という習慣・行為"],
            ["by + 交通手段", "by taxi / by train", "手段として抽象的に扱う"],
          ],
        },
      ],
    },
    {
      heading: "確認問題",
      blocks: [
        {
          type: "quiz",
          prompt: "空所に a / an / the / 無冠詞 のうち適切なものを入れよう。",
          rows: [
            { q: "I bought (　) new bag. (　) bag is blue.", a: "a / The", exp: "初出は a new bag、2回目は同じ bag なので The bag。" },
            { q: "(　) sun rises in (　) east.", a: "The / the", exp: "sun も east も共有されるもの＝共通認識の the。" },
            { q: "Sarah is (　) architect.", a: "an", exp: "architect は母音の音で始まる→an。" },
            { q: "I go to school by (　) bus.", a: "無冠詞", exp: "by + 交通手段は基本的に無冠詞。" },
            { q: "He is (　) university student.", a: "a", exp: "university は「ユ」＝子音の音→a。文字ではなく音で判断。" },
          ],
        },
      ],
    },
  ],
  relatedVocab: [
    { id: "00000000-0000-0000-0000-000000000021", title: "中学校英単語 基礎・標準" },
    { id: "00000000-0000-0000-0000-000000000045", title: "loop受験英単語①【中学完成】" },
  ],
  relatedGuides: [
    { slug: "chugaku-eigo-tango", title: "中学英語の単語を完璧に覚える方法" },
    { slug: "eibunpo-kiso", title: "英文法 基礎の覚え方" },
  ],
};

// 名詞レッスン（Notion: 中学英語攻略本#2 + ポラリス#23 を横断統合）
const meishi: Lesson = {
  slug: "meishi-kasan-fukasan",
  levelKey: "chugaku",
  order: 2,
  shortTitle: "名詞",
  title: "名詞の数え方【可算・不可算と複数形】",
  metaTitle: "名詞の数え方【可算名詞・不可算名詞・複数形の作り方】英文法",
  description:
    "英語の名詞は「数え方」まで考える。可算・不可算の見分け方、複数形の作り方、information など数えない名詞、a cup of の数え方、people・fish 型の特殊名詞まで例文付きで解説。確認問題あり。",
  keywords: "名詞, 可算名詞 不可算名詞, 複数形 作り方, information 数えられない, 英文法 名詞, 中学英語 名詞",
  heroLead: "名詞は『1つずつ区切れる形か／素材・概念か』で見る。日本語の感覚だけで数えない。",
  readTime: "8分",
  sections: [
    {
      heading: "名詞は「数え方」まで含めて考える",
      blocks: [
        {
          type: "p",
          text: "名詞は人・もの・こと・考えの名前を表す語。ただし英語では、意味がわかるだけでは足りない。使うたびに『1つの形がはっきりしたもの（可算）』なのか、『切っても性質が変わらない／目に見えないもの（不可算）』なのかを形で示す必要がある。",
        },
        {
          type: "callout",
          tone: "key",
          title: "判断のコツ",
          text: "「数えられる/られない」を日本語の感覚で決めない。英語がその名詞を『1つずつ区切れるもの』と見ているか、『素材・かたまり・情報・概念』と見ているかで判断する。",
        },
        {
          type: "table",
          headers: ["見方", "基本イメージ", "形の特徴", "例"],
          rows: [
            ["可算名詞", "1つの形がはっきりしている", "単数は a/an、複数は s/es", "a smartphone / koalas"],
            ["不可算名詞", "1個と切り出しにくい", "a/an をつけず複数形にしない", "water / information"],
            ["総称用法", "種類全体をまとめて言う", "冠詞なし複数形が多い", "I love avocados."],
          ],
        },
      ],
    },
    {
      heading: "可算名詞と複数形の基本",
      blocks: [
        {
          type: "p",
          text: "可算名詞は1つずつ数えられる名詞。単数で使うときは a / an / the / my などの目印が必要になりやすく、複数で使うときは基本的に語尾に s をつける。",
        },
        {
          type: "example",
          en: "He has three smartphones.",
          jp: "彼はスマホを3台持っている。",
          point: "数詞 three があっても名詞側も複数形にする。three smartphone ではなく smartphones。",
        },
        {
          type: "table",
          headers: ["パターン", "作り方", "例"],
          rows: [
            ["基本", "s をつける", "koala → koalas / app → apps"],
            ["s, x, sh, ch で終わる", "es をつける", "box → boxes / watch → watches"],
            ["子音字 + y", "y を i に変えて es", "strawberry → strawberries"],
            ["f / fe で終わる", "ves に変える（例外あり）", "leaf → leaves / life → lives"],
          ],
        },
        {
          type: "table",
          headers: ["不規則複数", "単数 → 複数"],
          rows: [
            ["母音が変わる", "man → men / foot → feet / tooth → teeth"],
            ["特殊な形", "child → children / person → people"],
            ["単複同形", "fish → fish / sheep → sheep"],
          ],
        },
      ],
    },
    {
      heading: "不可算名詞：「切ってもOK」「目に見えない」",
      blocks: [
        {
          type: "p",
          text: "不可算名詞は、英語で1つずつ区切りにくいものとして扱う名詞。代表イメージは2つ。『切っても性質が変わらないもの（水・パン・紙）』と『目に見えないもの（情報・助言・宿題）』だ。",
        },
        {
          type: "table",
          headers: ["イメージ", "例", "なぜ不可算か"],
          rows: [
            ["切ってもOK", "water / bread / rice / paper", "分けても性質が変わらない"],
            ["目に見えない", "information / advice / homework / news", "形がなく1個ずつ切り出せない"],
            ["かたまりで見る", "money / baggage / furniture", "語としては全体のかたまり"],
          ],
        },
        {
          type: "example",
          en: "I gathered a lot of information about the company.",
          jp: "その会社についてたくさんの情報を集めた。",
          point: "information は不可算。informations にしない。量が多いときは many ではなく a lot of / much。",
        },
        {
          type: "callout",
          tone: "warn",
          title: "入試・英検で狙われる",
          text: "advice / information / homework / news は不可算。「たくさんの〜」は many ではなく much / a lot of を使う。a piece of advice なら数えられる。",
        },
        {
          type: "callout",
          tone: "tip",
          title: "例外に注意",
          text: "目に見えなくても idea / hour / day は『1つずつ区切れる』ので可算（an idea / two hours）。見えるかどうかより『区切れるか』で見る。",
        },
      ],
    },
    {
      heading: "不可算名詞を数える：a cup of 型",
      blocks: [
        {
          type: "p",
          text: "不可算名詞を数えたいときは、名詞そのものを複数形にせず、入れ物・形・単位を使う。複数形にするのは入れ物（cup / piece など）の方だ。",
        },
        {
          type: "example",
          en: "My mother drinks five cups of coffee a day.",
          jp: "母は1日にコーヒーを5杯飲む。",
          point: "複数になるのは cups。coffee は液体として量で見るので two cups of coffees にはしない。",
        },
        {
          type: "table",
          headers: ["単位", "例", "数えるもの"],
          rows: [
            ["a cup of", "a cup of coffee", "cup を数える"],
            ["a glass of", "a glass of water", "glass を数える"],
            ["a sheet of", "a sheet of paper", "paper を枚数で言う"],
            ["a piece of", "a piece of advice / cake", "広く使える便利な単位"],
          ],
        },
      ],
    },
    {
      heading: "総称用法と the + 複数形",
      blocks: [
        {
          type: "p",
          text: "可算名詞で『種類全体』を表すときは、冠詞なしの複数形を使うことが多い（総称用法）。一方 the + 複数形 は『特定された集団』を指す。",
        },
        {
          type: "example",
          en: "I love cats.",
          jp: "私は猫が好きです。",
          point: "特定の猫ではなく猫という動物全般。the cats にすると「その猫たち」になる。",
        },
        {
          type: "example",
          en: "The teachers at my school are kind.",
          jp: "私の学校の先生たちは親切だ。",
          point: "at my school で範囲が限定された特定の集団。だから the teachers。",
        },
        {
          type: "callout",
          tone: "tip",
          title: "読解のサイン",
          text: "冠詞なしの複数名詞は一般論（種類全体）の可能性が高い。the + 複数名詞は文脈で限定された特定の集団。",
        },
      ],
    },
    {
      heading: "特殊な名詞：people / fish / go to school",
      blocks: [
        {
          type: "table",
          headers: ["タイプ", "例", "注意点"],
          rows: [
            ["people 型", "There are many people.", "people は複数扱い。There is にしない"],
            ["fish 型", "a lot of fish", "単複同形。数を表す語で判断"],
            ["go to school 型", "go to school / go to bed", "場所でなく目的・習慣→無冠詞"],
          ],
        },
        {
          type: "callout",
          tone: "tip",
          title: "go to school と go to the school",
          text: "生徒として通うなら go to school（無冠詞）。特定の学校の建物へ行くなら go to the school。目的か建物かで考える。",
        },
      ],
    },
    {
      heading: "確認問題",
      blocks: [
        {
          type: "quiz",
          prompt: "自然な形を選ぼう。",
          rows: [
            { q: "He has three (smartphone / smartphones).", a: "smartphones", exp: "数が2以上の可算名詞は複数形。" },
            { q: "I gathered a lot of (information / informations).", a: "information", exp: "information は不可算。s をつけない。" },
            { q: "five cups of (coffee / coffees)", a: "coffee", exp: "複数になるのは cups の方。" },
            { q: "There (is / are) many people in line.", a: "are", exp: "people は複数扱い。" },
            { q: "I (love cat / love cats).", a: "love cats", exp: "種類全体を言うなら冠詞なし複数形。" },
          ],
        },
      ],
    },
  ],
  relatedVocab: [
    { id: "00000000-0000-0000-0000-000000000021", title: "中学校英単語 基礎・標準" },
    { id: "00000000-0000-0000-0000-000000000040", title: "高校1年英語 重要単語" },
  ],
  relatedGuides: [
    { slug: "chugaku-eigo-tango", title: "中学英語の単語を完璧に覚える方法" },
    { slug: "eibunpo-kiso", title: "英文法 基礎の覚え方" },
  ],
};

export const LESSONS: Lesson[] = [kanshi, meishi];

export function getLesson(slug: string): Lesson | undefined {
  return LESSONS.find((l) => l.slug === slug);
}

export function getLessonNav(slug: string): { prev?: Lesson; next?: Lesson } {
  const sorted = [...LESSONS].sort((a, b) => a.order - b.order);
  const i = sorted.findIndex((l) => l.slug === slug);
  return { prev: sorted[i - 1], next: sorted[i + 1] };
}
