/**
 * /dictionary/[word] 公開単語詳細ページ — 第1弾PoCの24語。
 *
 * 選定基準: material_words内で12教材以上に登場し(=複数の試験区分で実際に
 * 使われている高頻度語)、かつ既存の英語例文・日本語訳を持つ語のみを対象にした
 * (根拠のない語の羅列にしないため)。例文(example/exampleJa)は許諾済み・自社作成の
 * material_wordsデータをそのまま採用。ニュアンス・覚え方・語源・関連語・反意語は
 * 外部辞書からの転載ではなく、このアプリのために新規に書き下ろした解説。
 *
 * isIndexEligible: 個々のページをindex対象にしてよいかのフラグ。今回の24語は
 * いずれも要件(例文あり・本文が薄くない・独自解説あり)を満たすためtrueにしているが、
 * 将来語数を増やす際は、この基準を満たさない語をfalseのまま追加できるようにしてある
 * (noindexにしたうえでページ自体は公開し、クロール・内部リンクは許可する設計)。
 */

export type PilotWord = {
  slug: string;
  word: string;
  ipa: string;
  pos: string;
  meaningJa: string;
  exampleEn: string;
  exampleJa: string;
  nuance: string;
  mnemonic: string;
  etymology: string;
  relatedWords: string[];
  antonyms: string[];
  examLevels: string[];
  relatedGuideSlug: string;
  isIndexEligible: boolean;
};

export const PILOT_WORDS: PilotWord[] = [
  {
    slug: "analyze",
    word: "analyze",
    ipa: "/ˈænəlaɪz/",
    pos: "動詞",
    meaningJa: "分析する、分析して理解する",
    exampleEn: "Economists analyze market trends to predict future economic growth.",
    exampleJa: "経済学者は市場動向を分析して将来の経済成長を予測する。",
    nuance:
      "「調べる」全般を指す examine と違い、analyze は物事を要素に分解して構造や原因を理解しようとするニュアンスが強い動詞です。データ・文章・状況など、複数の要素からなるものを対象に使われます。",
    mnemonic:
      "analyze は ana-(分けて)+ lyze(緩める・解く)という成り立ちを持ちます。「バラバラに分解して(ana)、緩めて中身を見る(lyze)」とイメージすると、単なる「見る」ではなく「分解して理解する」という意味が結びつきやすくなります。",
    etymology:
      "ギリシャ語の analyein（ana-「上に、分けて」+ lyein「緩める、解く」）に由来します。もともとは「解きほぐす」という意味で、そこから「要素に分けて理解する」という現在の意味に発展しました。",
    relatedWords: ["analysis（名詞：分析）", "analytical（形容詞：分析的な）", "examine（動詞：調べる）"],
    antonyms: ["synthesize（統合する）"],
    examLevels: ["英検準1級", "大学受験標準〜難関", "TOEIC"],
    relatedGuideSlug: "university-exam-vocabulary",
    isIndexEligible: true,
  },
  {
    slug: "available",
    word: "available",
    ipa: "/əˈveɪləbl/",
    pos: "形容詞",
    meaningJa: "利用可能な、入手可能な、手が空いている",
    exampleEn: "Information about the conference is now available online.",
    exampleJa: "会議に関する情報はオンラインで利用可能になった。",
    nuance:
      "「モノが手に入る状態」と「人の予定が空いている状態」の両方に使える便利な形容詞です。ビジネス英語では “Are you available tomorrow?”（明日空いていますか）のように人にも使われます。",
    mnemonic:
      "available は avail（役に立つ、活用する）+ -able（〜できる）という構成です。「活用できる状態にある」＝「利用可能」と覚えると、TOEICでよく出る “available for purchase”（購入可能）などの表現にも繋げやすくなります。",
    etymology:
      "古フランス語 availler（役立つ）に由来し、さらに遡るとラテン語の valere（強い、価値がある）に行き着きます。「価値を発揮できる状態」というのが元々のイメージです。",
    relatedWords: ["availability（名詞：利用可能性）", "accessible（形容詞：利用しやすい）"],
    antonyms: ["unavailable（利用できない）"],
    examLevels: ["英検2級", "TOEIC", "高校基礎"],
    relatedGuideSlug: "toeic-tango",
    isIndexEligible: true,
  },
  {
    slug: "improve",
    word: "improve",
    ipa: "/ɪmˈpruːv/",
    pos: "動詞",
    meaningJa: "改善する、上達する",
    exampleEn: "The new system will help improve productivity in the workplace.",
    exampleJa: "新しいシステムは職場の生産性の改善に役立つでしょう。",
    nuance:
      "「良くなる／良くする」という意味の中でも、既に存在するものの質を高めるというニュアンスがあります。ゼロから作る develop とは対照的に、improve は「今あるものをより良くする」場面で使われます。",
    mnemonic:
      "im-（中へ）+ prove（証明する、試す）の成り立ちから、「試して中身をより良くしていく」というイメージで覚えると定着しやすい単語です。",
    etymology:
      "古フランス語 emprouer（利益を得る）に由来し、ラテン語の prode（利益）と関連があります。「利益を生み出すように良くする」という発想から現在の意味に発展しました。",
    relatedWords: ["improvement（名詞：改善）", "enhance（動詞：高める）", "upgrade（動詞：向上させる）"],
    antonyms: ["worsen（悪化させる）", "decline（衰える）"],
    examLevels: ["英検2級", "TOEIC", "高校基礎"],
    relatedGuideSlug: "how-to-memorize-english-words",
    isIndexEligible: true,
  },
  {
    slug: "support",
    word: "support",
    ipa: "/səˈpɔːrt/",
    pos: "動詞・名詞",
    meaningJa: "支える、支持する／支援、サポート",
    exampleEn: "My family always supports my dreams.",
    exampleJa: "私の家族はいつも私の夢を支えてくれます。",
    nuance:
      "物理的に「支える」意味と、精神的・経済的に「支援する」意味の両方をカバーする語です。help よりもフォーマルで、ビジネス・カスタマーサポートの文脈でもよく使われます。",
    mnemonic:
      "sup-（下から）+ port（運ぶ、支える）の成り立ちで、「下から支えて運ぶ」というイメージを持つと、物理的な支えと精神的な支えの両方の意味が理解しやすくなります。",
    etymology:
      "ラテン語 supportare（sub-「下から」+ portare「運ぶ」）に由来します。「下から持ち上げて運ぶ」という文字通りの意味から、「支える・支援する」に発展しました。",
    relatedWords: ["supportive（形容詞：協力的な）", "assist（動詞：手伝う）", "backup（名詞：後押し）"],
    antonyms: ["oppose（反対する）", "hinder（妨げる）"],
    examLevels: ["英検準2級", "TOEIC", "高校基礎"],
    relatedGuideSlug: "eiken-vocabulary-study",
    isIndexEligible: true,
  },
  {
    slug: "evaluate",
    word: "evaluate",
    ipa: "/ɪˈvæljueɪt/",
    pos: "動詞",
    meaningJa: "評価する、査定する",
    exampleEn: "Teachers evaluate students' progress every term.",
    exampleJa: "教師は毎学期、生徒の進歩を評価します。",
    nuance:
      "単なる感想の judge とは異なり、基準に沿って価値・程度を測るというニュアンスが強い、ややフォーマルな動詞です。学術論文やビジネス文書に頻出します。",
    mnemonic:
      "e-（外に）+ value（価値）+ -ate（〜する）という成り立ちから、「価値を外に引き出して測る」＝「評価する」とイメージすると覚えやすくなります。",
    etymology:
      "フランス語 évaluer に由来し、ラテン語の valere（価値がある）が語源です。value（価値）と語根を共有していることを意識すると記憶に残りやすい単語です。",
    relatedWords: ["evaluation（名詞：評価）", "assess（動詞：査定する）", "estimate（動詞：見積もる）"],
    antonyms: [],
    examLevels: ["大学受験標準", "TOEIC"],
    relatedGuideSlug: "spaced-repetition-english-vocabulary",
    isIndexEligible: true,
  },
  {
    slug: "consequence",
    word: "consequence",
    ipa: "/ˈkɒnsɪkwəns/",
    pos: "名詞",
    meaningJa: "結果、影響（多くは好ましくない結果を指す）",
    exampleEn: "The consequence of pollution is visible in many cities.",
    exampleJa: "汚染の影響は多くの都市で見られる。",
    nuance:
      "result が中立的な「結果」を表すのに対し、consequence はしばしば「ある行動によってもたらされる（望ましくないことも多い）帰結」というニュアンスを含みます。“as a consequence of〜”（〜の結果として）の形で長文によく登場します。",
    mnemonic:
      "con-（共に）+ sequence（連続、続くもの）という構成です。「ある出来事に続いて起こること」というイメージを持つと、原因と結果のつながりが意識しやすくなります。",
    etymology:
      "ラテン語 consequentia（con-「共に」+ sequi「従う」）に由来します。sequence（連続）・sequel（続編）と語根 sequ- を共有しています。",
    relatedWords: ["consequently（副詞：その結果として）", "result（名詞：結果）", "outcome（名詞：成果）"],
    antonyms: ["cause（原因）"],
    examLevels: ["英検2級", "大学受験標準", "高校基礎"],
    relatedGuideSlug: "university-exam-vocabulary",
    isIndexEligible: true,
  },
  {
    slug: "issue",
    word: "issue",
    ipa: "/ˈɪʃuː/",
    pos: "動詞・名詞",
    meaningJa: "発行する／問題、論点、（雑誌の）号",
    exampleEn: "The bank issued a new credit card.",
    exampleJa: "その銀行は新しいクレジットカードを発行しました。",
    nuance:
      "TOEICでは「発行する」という動詞の意味が頻出（issue a statement=声明を出す 等）ですが、日常英語や長文読解では「問題・論点」という名詞の意味で使われることが多く、文脈によって訳し分けが必要な語です。",
    mnemonic:
      "「出す（issue）」という核となるイメージから、「公式に外へ出す」→ 発行する、「表面に出てきたこと」→ 問題・論点、というように意味が枝分かれしていくと考えると整理しやすくなります。",
    etymology:
      "古フランス語 issue（出口、出ること）に由来し、ラテン語 exire（ex-「外へ」+ ire「行く」）が語源です。「外に出ていくもの」というのが元々のイメージです。",
    relatedWords: ["issuance（名詞：発行）", "topic（名詞：話題）", "problem（名詞：問題）"],
    antonyms: [],
    examLevels: ["TOEIC", "共通テスト標準", "高校基礎"],
    relatedGuideSlug: "toeic-tango",
    isIndexEligible: true,
  },
  {
    slug: "hypothesis",
    word: "hypothesis",
    ipa: "/haɪˈpɒθəsɪs/",
    pos: "名詞",
    meaningJa: "仮説",
    exampleEn: "The null hypothesis in statistical analysis assumes no significant difference.",
    exampleJa: "統計分析における帰無仮説は有意な差がないことを想定する。",
    nuance:
      "検証される前の「仮の説明・予想」を指す学術的な語です。theory（体系立てて検証済みの理論）とは段階が異なり、hypothesis はまだ実証されていない仮定という点がポイントです。",
    mnemonic:
      "hypo-（下に、〜未満の）+ thesis（主張、命題）という構成です。「まだ土台の下にある（証明されていない）主張」というイメージで覚えると、theory との違いも意識しやすくなります。",
    etymology:
      "ギリシャ語 hypothesis（hypo-「下に」+ thesis「置くこと」）に由来します。「下に置かれた前提」というのが元々の意味です。",
    relatedWords: ["hypothesize（動詞：仮説を立てる）", "theory（名詞：理論）", "assumption（名詞：仮定）"],
    antonyms: [],
    examLevels: ["大学受験難関〜最難関", "英検準1級"],
    relatedGuideSlug: "university-exam-vocabulary",
    isIndexEligible: true,
  },
  {
    slug: "authority",
    word: "authority",
    ipa: "/əˈθɒrəti/",
    pos: "名詞",
    meaningJa: "権威、権限、（複数形で）当局",
    exampleEn: "The health authority recommended new safety measures.",
    exampleJa: "保健当局は新しい安全対策を勧告した。",
    nuance:
      "「〜する権限」という意味と、「the authorities」で「政府機関・当局」を指す意味の両方があります。長文読解では複数形 authorities で「当局」の意味になっているケースが多く、注意が必要です。",
    mnemonic:
      "author（著者、創造者）と語根が近く、「物事を生み出し、決める権限を持つ人」というイメージで覚えると、権威・権限のニュアンスがつながります。",
    etymology:
      "ラテン語 auctoritas（auctor「創始者、後見人」に由来）から来ています。author（著者）と同じ語根 auct-/auth- を共有しています。",
    relatedWords: ["authorize（動詞：許可する）", "authoritative（形容詞：権威のある）", "power（名詞：権力）"],
    antonyms: [],
    examLevels: ["英検2級", "TOEIC", "高校基礎"],
    relatedGuideSlug: "eiken-vocabulary-study",
    isIndexEligible: true,
  },
  {
    slug: "benefit",
    word: "benefit",
    ipa: "/ˈbenɪfɪt/",
    pos: "名詞・動詞",
    meaningJa: "利益、恩恵／利益を得る",
    exampleEn: "Exercise has many benefits for our health.",
    exampleJa: "運動は私たちの健康に多くの恩恵をもたらします。",
    nuance:
      "profit（金銭的な利益）よりも広い意味を持ち、健康・生活の質など金銭以外の「良い効果」にも使えます。“benefit from〜”（〜から利益を得る）の形も頻出です。",
    mnemonic:
      "bene-（良い）+ fit（〜をする、作る）という構成です。ラテン語由来の bene- は benefit（恩恵）・benevolent（親切な）など「良い」を意味する接頭辞として繰り返し登場します。",
    etymology:
      "ラテン語 benefactum（bene「良く」+ facere「行う」）に由来します。「良いことを行う」というのが元の意味です。",
    relatedWords: ["beneficial（形容詞：有益な）", "advantage（名詞：利点）", "gain（名詞：利益）"],
    antonyms: ["drawback（欠点）", "disadvantage（不利益）"],
    examLevels: ["高校基礎", "TOEIC", "共通テスト標準"],
    relatedGuideSlug: "how-to-memorize-english-words",
    isIndexEligible: true,
  },
  {
    slug: "apply",
    word: "apply",
    ipa: "/əˈplaɪ/",
    pos: "動詞",
    meaningJa: "応募する、申し込む／適用する",
    exampleEn: "She decided to apply for a scholarship to study abroad.",
    exampleJa: "彼女は海外留学するための奨学金に応募することにした。",
    nuance:
      "「apply for＋役職・制度」で応募する、「apply A to B」でAをBに適用する、という2つの用法を押さえておく必要がある多義語です。前置詞の違いで意味が変わる点がテストで問われやすいポイントです。",
    mnemonic:
      "ap-（〜へ）+ ply（折り重ねる、向ける）という成り立ちから、「自分を〜へ向けて差し出す」というイメージを持つと、応募する・適用するの両方の意味が理解しやすくなります。",
    etymology:
      "古フランス語 aplier に由来し、ラテン語 applicare（ad-「〜へ」+ plicare「折りたたむ」）が語源です。「〜に向けて折り重ねる」というのが元のイメージです。",
    relatedWords: ["application（名詞：応募、応用）", "applicant（名詞：応募者）", "apply for（〜に応募する）"],
    antonyms: [],
    examLevels: ["英検2級", "TOEIC", "高校基礎"],
    relatedGuideSlug: "school-test-vocabulary",
    isIndexEligible: true,
  },
  {
    slug: "affect",
    word: "affect",
    ipa: "/əˈfekt/",
    pos: "動詞",
    meaningJa: "影響する、作用する",
    exampleEn: "Lack of sleep affects your concentration.",
    exampleJa: "睡眠不足はあなたの集中力に影響します。",
    nuance:
      "名詞の effect（結果、効果）とスペル・発音が似ているため混同されがちですが、affect は基本的に動詞（〜に影響する）、effect は基本的に名詞（結果、効果）として使われます。この区別は英検・大学受験で頻出のひっかけポイントです。",
    mnemonic:
      "「Affect は Action（動詞）、Effect は Ending（名詞・結果）」と頭文字を対応させて覚えると、品詞の混同を防ぎやすくなります。",
    etymology:
      "ラテン語 afficere（ad-「〜へ」+ facere「行う、作る」）に由来します。「〜に対して働きかける」というのが元の意味です。",
    relatedWords: ["effect（名詞：効果、結果）", "influence（動詞：影響する）", "impact（動詞：影響を与える）"],
    antonyms: [],
    examLevels: ["英検3級", "TOEIC", "高校基礎"],
    relatedGuideSlug: "flashcards-vs-multiple-choice",
    isIndexEligible: true,
  },
  {
    slug: "maintain",
    word: "maintain",
    ipa: "/meɪnˈteɪn/",
    pos: "動詞",
    meaningJa: "維持する、（意見などを）主張する",
    exampleEn: "It is important to maintain a healthy diet.",
    exampleJa: "健康的な食事を維持することは大切です。",
    nuance:
      "「今ある状態を保つ」というのが基本の意味ですが、“maintain that〜”の形で「〜だと主張する」という意味にもなる点に注意が必要です。TOEICでは設備の「保守・整備」の意味でもよく使われます。",
    mnemonic:
      "main-（手で）+ tain（保つ）という成り立ちで、「手で持ち続ける」というイメージから「維持する」の意味につながります。maintenance（メンテナンス、保守）という日本語にもなったカタカナ語と関連づけると覚えやすい単語です。",
    etymology:
      "古フランス語 maintenir（main「手」+ tenir「保つ」）に由来し、ラテン語 manu tenere（手で保つ）が語源です。",
    relatedWords: ["maintenance（名詞：維持、保守）", "sustain（動詞：持続させる）", "preserve（動詞：保存する）"],
    antonyms: ["abandon（放棄する）", "neglect（怠る）"],
    examLevels: ["英検準2級", "TOEIC", "共通テスト標準"],
    relatedGuideSlug: "toeic-tango",
    isIndexEligible: true,
  },
  {
    slug: "environment",
    word: "environment",
    ipa: "/ɪnˈvaɪrənmənt/",
    pos: "名詞",
    meaningJa: "環境",
    exampleEn: "We must protect the environment for future generations.",
    exampleJa: "私たちは将来の世代のために環境を守らなければならない。",
    nuance:
      "自然環境（the environment）だけでなく、「働く環境」「学習環境」のように、人を取り巻く状況全般に使える語です。長文読解では environmental issue（環境問題）のようにセットで登場することが多い単語です。",
    mnemonic:
      "environ（〜を取り囲む）+ -ment（名詞化語尾）という成り立ちから、「自分を取り囲んでいるもの全体」というイメージを持つと覚えやすくなります。",
    etymology:
      "古フランス語 environ（周囲に）に由来し、virer（回る、旋回する）が語源にあります。「周りを取り巻くもの」という発想から現在の意味に発展しました。",
    relatedWords: ["environmental（形容詞：環境の）", "surroundings（名詞：周囲）", "ecosystem（名詞：生態系）"],
    antonyms: [],
    examLevels: ["英検2級", "TOEIC", "高校基礎"],
    relatedGuideSlug: "eiken-vocabulary-study",
    isIndexEligible: true,
  },
  {
    slug: "research",
    word: "research",
    ipa: "/rɪˈsɜːrtʃ/",
    pos: "名詞・動詞",
    meaningJa: "研究、調査／研究する",
    exampleEn: "Medical research has led to many breakthrough treatments.",
    exampleJa: "医学研究は多くの画期的な治療法につながった。",
    nuance:
      "study（学習・調査）よりも体系的・学術的なニュアンスが強い語です。不可算名詞として使われることが多く、“a research”ではなく“a research project”や“some research”のように使う点に注意が必要です。",
    mnemonic:
      "re-（再び）+ search（探す）という成り立ちから、「何度も探し直す」＝徹底的に調べる、というイメージで覚えると定着しやすい単語です。",
    etymology:
      "古フランス語 recercher（re-「再び」+ cercher「探す」）に由来します。cercher は circle（円）と語根を共有し、「ぐるりと探し回る」というのが元のイメージです。",
    relatedWords: ["researcher（名詞：研究者）", "investigate（動詞：調査する）", "study（名詞・動詞：研究）"],
    antonyms: [],
    examLevels: ["英検2級", "TOEIC", "共通テスト標準"],
    relatedGuideSlug: "ai-vocabulary-learning",
    isIndexEligible: true,
  },
  {
    slug: "influence",
    word: "influence",
    ipa: "/ˈɪnfluəns/",
    pos: "名詞・動詞",
    meaningJa: "影響（力）／影響を与える",
    exampleEn: "Social media influences the opinions and behaviors of young people.",
    exampleJa: "ソーシャルメディアは若い人の意見と行動に影響します。",
    nuance:
      "affect（動詞のみ、単に「影響する」）と違い、influence は名詞・動詞どちらでも使え、「〜の考え方や行動を変えるような力」という、やや持続的・間接的な影響を表すことが多い語です。",
    mnemonic:
      "in-（中に）+ flu（流れる）+ -ence（名詞化語尾）という成り立ちから、「相手の中に流れ込んでいく力」というイメージを持つと覚えやすくなります。influenza（インフルエンザ）も同じ語根 flu- を持ちます。",
    etymology:
      "中世ラテン語 influentia（in-「中に」+ fluere「流れる」）に由来します。もともとは星の力が人に「流れ込む」という占星術的な発想から来ています。",
    relatedWords: ["influential（形容詞：影響力のある）", "impact（名詞：影響）", "affect（動詞：影響する）"],
    antonyms: [],
    examLevels: ["英検2級", "英検準2級", "TOEIC"],
    relatedGuideSlug: "school-test-vocabulary",
    isIndexEligible: true,
  },
  {
    slug: "sustainable",
    word: "sustainable",
    ipa: "/səˈsteɪnəbl/",
    pos: "形容詞",
    meaningJa: "持続可能な",
    exampleEn: "We need to develop sustainable energy sources to protect the environment.",
    exampleJa: "環境を保護するために、持続可能なエネルギー源を開発する必要があります。",
    nuance:
      "「環境や資源を損なわずに、長期間続けられる」という意味で、SDGs関連の英文で頻出する語です。単に「続く」だけでなく「無理なく続けられる」というニュアンスを含みます。",
    mnemonic:
      "sus-（下から）+ tain（保つ）+ -able（〜できる）という成り立ちで、「下から支え続けることができる」というイメージを持つと、maintain（維持する）との語根の共通性にも気づきやすくなります。",
    etymology:
      "ラテン語 sustinere（sub-「下から」+ tenere「保つ」）に由来します。maintain と同じ tenere（保つ）を語源に持つ仲間の単語です。",
    relatedWords: ["sustainability（名詞：持続可能性）", "sustain（動詞：持続させる）", "renewable（形容詞：再生可能な）"],
    antonyms: ["unsustainable（持続不可能な）"],
    examLevels: ["英検2級", "TOEIC標準", "大学受験標準"],
    relatedGuideSlug: "university-exam-vocabulary",
    isIndexEligible: true,
  },
  {
    slug: "innovation",
    word: "innovation",
    ipa: "/ˌɪnəˈveɪʃn/",
    pos: "名詞",
    meaningJa: "革新、新しい工夫",
    exampleEn: "Technological innovation drives economic growth and productivity improvements.",
    exampleJa: "技術革新は経済成長と生産性向上を推進する。",
    nuance:
      "単なる「変化」ではなく、「新しいアイデアや方法を導入すること」という前向きなニュアンスを持つ語です。ビジネス英語・大学受験の長文どちらでも頻出のキーワードです。",
    mnemonic:
      "in-（中に）+ nov（新しい）+ -ation（名詞化語尾）という成り立ちです。novel（斬新な、小説）・novice（初心者）と同じ nov-（新しい）という語根を持つ点を意識すると覚えやすくなります。",
    etymology:
      "ラテン語 innovare（in-「中に」+ novare「新しくする」）に由来します。「中に新しいものを取り入れる」というのが元の意味です。",
    relatedWords: ["innovative（形容詞：革新的な）", "innovate（動詞：革新する）", "invention（名詞：発明）"],
    antonyms: ["tradition（伝統）"],
    examLevels: ["大学受験難関〜最難関", "TOEIC", "英検2級"],
    relatedGuideSlug: "university-exam-vocabulary",
    isIndexEligible: true,
  },
  {
    slug: "strategy",
    word: "strategy",
    ipa: "/ˈstrætədʒi/",
    pos: "名詞",
    meaningJa: "戦略、方策",
    exampleEn: "The company developed a new marketing strategy to reach younger audiences.",
    exampleJa: "企業は若い視聴者に到達するための新しいマーケティング戦略を開発しました。",
    nuance:
      "その場しのぎの方法（tactic）ではなく、長期的な目標達成のための「全体的な計画」を指す語です。学習法の話でも“study strategy”（学習戦略）のように使われます。",
    mnemonic:
      "元は「将軍術」を意味するギリシャ語 strategos（軍を率いる者）に由来します。「戦場全体を見渡して立てる作戦」というイメージを持つと、ビジネスや学習における「戦略」の意味にもつながります。",
    etymology:
      "ギリシャ語 strategia（stratos「軍」+ agein「導く」）に由来します。strategy と strategic（戦略的な）は同じ語根を共有しています。",
    relatedWords: ["strategic（形容詞：戦略的な）", "tactic（名詞：戦術）", "plan（名詞：計画）"],
    antonyms: [],
    examLevels: ["英検2級", "TOEIC基礎〜標準", "共通テスト標準"],
    relatedGuideSlug: "tangocho-erabikata",
    isIndexEligible: true,
  },
  {
    slug: "solution",
    word: "solution",
    ipa: "/səˈluːʃn/",
    pos: "名詞",
    meaningJa: "解決策、解決",
    exampleEn: "Scientists are working to find a solution to plastic pollution.",
    exampleJa: "科学者たちはプラスチック汚染の解決策を見つけるために取り組んでいる。",
    nuance:
      "「solution to＋問題」の形で使われることが多く、前置詞は for ではなく to を取る点が入試・TOEICでよく問われます。化学の「溶液」という意味も持つ多義語です。",
    mnemonic:
      "solve（解く）+ -tion（名詞化語尾）という成り立ちで、solve（解決する）とセットで覚えると定着しやすい語です。「問題を溶かして(dissolve)なくす」というイメージも化学の「溶液」の意味とつながります。",
    etymology:
      "ラテン語 solutio（solvere「緩める、解く」）に由来します。solve・dissolve（溶かす）・resolve（解決する）と同じ語根 solv-/solu- を共有する仲間の単語です。",
    relatedWords: ["solve（動詞：解決する）", "resolve（動詞：解決する）", "answer（名詞：答え）"],
    antonyms: ["problem（問題）"],
    examLevels: ["英検2級", "TOEIC基礎〜標準", "大学受験標準"],
    relatedGuideSlug: "spaced-repetition-english-vocabulary",
    isIndexEligible: true,
  },
  {
    slug: "appropriate",
    word: "appropriate",
    ipa: "/əˈproʊpriət/",
    pos: "形容詞",
    meaningJa: "適切な、ふさわしい",
    exampleEn: "It is appropriate to wear formal clothes to a business meeting.",
    exampleJa: "ビジネスミーティングにはフォーマルな服装を着るのが適切である。",
    nuance:
      "right（正しい）よりもフォーマルで、「その場・状況にふさわしい」という文脈依存のニュアンスを持つ語です。“appropriate for〜”の形で使われることが多くあります。",
    mnemonic:
      "ap-（〜へ）+ propri（自分自身の、固有の）という成り立ちで、「その場に固有にふさわしいものへ近づける」というイメージを持つと覚えやすくなります。proper（適切な）と語根を共有しています。",
    etymology:
      "ラテン語 appropriare（ad-「〜へ」+ proprius「自分自身の」）に由来します。proper（適切な）・property（財産、性質）と同じ語根 propri- を持つ単語です。",
    relatedWords: ["proper（形容詞：適切な）", "suitable（形容詞：ふさわしい）", "fitting（形容詞：ふさわしい）"],
    antonyms: ["inappropriate（不適切な）"],
    examLevels: ["英検2級", "英検準1級", "TOEIC基礎〜標準"],
    relatedGuideSlug: "eiken-vocabulary-study",
    isIndexEligible: true,
  },
  {
    slug: "significant",
    word: "significant",
    ipa: "/sɪɡˈnɪfɪkənt/",
    pos: "形容詞",
    meaningJa: "重要な、著しい、有意な",
    exampleEn: "There was a significant change in his attitude.",
    exampleJa: "彼の態度に著しい変化がありました。",
    nuance:
      "important（重要な）より、変化の大きさ・統計的な意味合いを強調するときに使われることが多い語です。統計学の文脈では「有意な（偶然とは考えにくい）」という専門的な意味にもなります。",
    mnemonic:
      "sign（記号、しるし）+ -ify（〜化する）+ -ant（形容詞語尾）という成り立ちから、「はっきりとしたしるしを示すほどの」というイメージを持つと覚えやすくなります。",
    etymology:
      "ラテン語 significare（signum「しるし」+ facere「作る」）に由来します。sign（しるし）・signal（信号）と語根を共有しています。",
    relatedWords: ["significance（名詞：重要性）", "significantly（副詞：著しく）", "considerable（形容詞：かなりの）"],
    antonyms: ["insignificant（取るに足らない）", "minor（軽微な）"],
    examLevels: ["高校基礎", "TOEIC基礎〜標準", "大学受験標準"],
    relatedGuideSlug: "how-to-memorize-english-words",
    isIndexEligible: true,
  },
  {
    slug: "approach",
    word: "approach",
    ipa: "/əˈproʊtʃ/",
    pos: "動詞・名詞",
    meaningJa: "近づく、取り組む／取り組み方、接近",
    exampleEn: "The government's approach to healthcare reform was controversial.",
    exampleJa: "医療改革に対する政府のアプローチは議論の余地がある。",
    nuance:
      "物理的に「近づく」意味に加え、名詞では「問題への取り組み方・手法」という意味で頻出します。“approach to〜”の形で使われ、前置詞 to を伴う点が特徴です。",
    mnemonic:
      "ap-（〜へ）+ proach（近い、proximate と同語源）という成り立ちで、「〜へ近づいていく」というコアイメージを持つと、物理的な接近も、問題への向き合い方も同じ発想でつながります。",
    etymology:
      "古フランス語 aprochier に由来し、後期ラテン語 appropiare（ad-「〜へ」+ propius「より近く」）が語源です。proximity（近さ）と語根が近い単語です。",
    relatedWords: ["approachable（形容詞：親しみやすい）", "method（名詞：方法）", "attitude（名詞：姿勢）"],
    antonyms: ["avoidance（回避）"],
    examLevels: ["英検準1級", "TOEIC", "大学受験標準"],
    relatedGuideSlug: "university-exam-vocabulary",
    isIndexEligible: true,
  },
  {
    slug: "phenomenon",
    word: "phenomenon",
    ipa: "/fəˈnɒmɪnən/",
    pos: "名詞",
    meaningJa: "現象",
    exampleEn: "The phenomenon of climate change poses unprecedented challenges to humanity.",
    exampleJa: "気候変動という現象は人類に前例のない課題をもたらしている。",
    nuance:
      "自然現象・社会現象など、観察・説明の対象となる出来事を指す学術的な語です。複数形は phenomena になる点（不規則変化）が試験でよく問われます。",
    mnemonic:
      "phen-（現れる、示す）という語根から、「目の前に現れて観察されるもの」というイメージを持つと覚えやすくなります。fantasy（幻想）・fancy（〜と思う）とも遠い語根でつながっています。",
    etymology:
      "ギリシャ語 phainomenon（phainein「現れる、見せる」の現在分詞）に由来します。「現れているもの」というのが元の意味です。",
    relatedWords: ["phenomena（名詞：phenomenonの複数形）", "occurrence（名詞：出来事）", "event（名詞：出来事）"],
    antonyms: [],
    examLevels: ["大学受験難関", "英検準1級"],
    relatedGuideSlug: "university-exam-vocabulary",
    isIndexEligible: true,
  },
];

export const PILOT_WORD_SLUGS = PILOT_WORDS.map((w) => w.slug);

export function getPilotWord(slug: string): PilotWord | undefined {
  return PILOT_WORDS.find((w) => w.slug === slug);
}
