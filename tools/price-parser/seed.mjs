// Початковий набір: магазини, матеріали з правилами відстеження й сторінки категорій.
// Робочі дані живуть у базі (suppliers.parser_key, materials.parse_rule, price_sources) і правляться в CRM;
// цей файл — для першого наповнення (node seed-sql.mjs) і для запусків без бази (--local).

const LUMBER_NONE =
  "необрізн|необрезн|зрощ|сращ|клеєн|клеен|терас|палубн|лавочн|вагонк|фальш|імітац|имитац|блок.?хаус|планкен|" +
  "дуб|ясен|вільх|ольх|липа|бук|модрин|лиственн|термо|шпунт|підлог|полов|наличник|плінтус|плинтус|поруч|балясин|" +
  "щит|штахет|кіл[оь]к|колышек|стовп|столб|двп|дсп|осб|osb|фанер|піддон|поддон|дрова";

const SIZES = [
  ["Брус", 50, 50], ["Дошка", 50, 100], ["Дошка", 50, 150], ["Дошка", 50, 200],
  ["Рейка", 30, 30], ["Дошка", 20, 100], ["Дошка", 25, 100],
];
const TYPES = [["fresh", "свіжопиляна"], ["dry", "суха"], ["planed", "суха калібрована (стругана)"]];
const fem = (word, label) => (word === "Брус" ? label.replace("свіжопиляна", "свіжопиляний").replace("суха", "сухий").replace("калібрована", "калібрований").replace("стругана", "струганий") : label);

const lumber = SIZES.flatMap(([word, a, b]) =>
  TYPES.map(([type, label]) => ({
    name: `${word} ${a}×${b} ${fem(word, label)}`,
    category: "Дерево",
    unit: "м³",
    spec: `Сосна/ялина, переріз ${a}×${b} мм, довжина будь-яка. Ціна за м³; у пропозиціях — ще за м.п. і за штуку.`,
    rule: { groups: ["lumber"], norm: "lumber", a, b, type, all: ["дошк|доск|брус|рейк|балк|лаг[аи]|стійк"], none: LUMBER_NONE },
  }))
);

const BASALT =
  "базальт|камʼян|кам'ян|каменн|rockwool|роквул|rockmin|izovat|ізоват|изоват|paroc|термолайф|termolife|белтеп|beltep|" +
  "sweetondale|технонік|техноник|technonicol|техноблок|технолайт|basfiber|izolux|роклайт|rocklight|basalt";
const WOOL_NONE =
  "скловат|стекловат|скловолок|стекловолок|knauf|кнауф|isover|ізовер|изовер|ursa|урса|рулон|ламел|циліндр|цилиндр|фольг|шкаралуп|скорлуп|" +
  "пінопласт|пенопласт|xps|eps|полістирол|полистирол|клей|дюбел|сендвіч|сэндвич|димох|дымоход";
const wool = [50, 100].map((th) => ({
  name: `Базальтова вата ${th} мм (плита для каркаса)`,
  category: "Утеплювач",
  unit: "м³",
  spec: `Плита ${th} мм, легка (до 70 кг/м³), будь-який виробник і розмір плити. Ціна за м³; у пропозиціях — за упаковку й м².`,
  rule: { groups: ["wool"], norm: "pack_m3", thickness: th, density: [20, 70], all: ["вата|утепл|плит|теплоізол|теплоизол", BASALT], none: WOOL_NONE, min: 800, max: 12000 },
}));

const VAPOR = "пароб|пароізол|парои|паро.?бар";
const TAPE_WORD = "скотч|стрічк|лента";
const films = [
  {
    name: "Мембрана супердифузійна (фасад, покрівля)", unit: "м²",
    spec: "Вітро-вологозахисна паропроникна мембрана 80–250 г/м². Ціна за м²; у пропозиціях — за рулон і площа рулону.",
    rule: { groups: ["membrane"], norm: "roll_m2", density: [80, 250], all: ["мембран|плівк|пленк", "супердиф|супер.?диф|дифузійн|диффузион"], none: `${TAPE_WORD}|клей|звукоізол|фундамент`, min: 8, max: 250 },
  },
  {
    name: "Паробарʼєр (плівка)", unit: "м²",
    spec: "Пароізоляційна плівка без фольги й армування. Ціна за м².",
    rule: { groups: ["membrane"], norm: "roll_m2", all: [VAPOR], none: `фольг|алюмін|алюмин|металіз|метализ|армов|армир|супердиф|${TAPE_WORD}|мастик|клей`, min: 3, max: 150 },
  },
  {
    name: "Паробарʼєр армований", unit: "м²",
    spec: "Пароізоляційна плівка, армована сіткою. Ціна за м².",
    rule: { groups: ["membrane"], norm: "roll_m2", all: [VAPOR, "армов|армир"], none: `фольг|алюмін|алюмин|металіз|метализ|${TAPE_WORD}`, min: 5, max: 200 },
  },
  {
    name: "Паробарʼєр фольгований", unit: "м²",
    spec: "Пароізоляція з алюмінієвим (відбивним) шаром. Ціна за м².",
    rule: { groups: ["membrane"], norm: "roll_m2", all: [VAPOR, "фольг|алюмін|алюмин|металіз|метализ"], none: TAPE_WORD, min: 8, max: 300 },
  },
  {
    name: "Скотч алюмінієвий (фольгований) для стиків", unit: "м.п.",
    spec: "Алюмінієва клейка стрічка для проклейки стиків, рулони 40–50 м. Ціна за м.п.; у пропозиціях — за рулон.",
    rule: { groups: ["tape"], norm: "roll_mp", all: [TAPE_WORD, "алюмін|алюмин|фольг"], none: "бутил|бітум|битум|малярн|двосторон|двухсторон|герлен|димох|дымоход|флізелін|флизелин|вставк|серпянк", min: 0.5, max: 80 },
  },
  {
    name: "Стрічка для супердифузійних мембран (зʼєднувальна)", unit: "м.п.",
    spec: "Клейка стрічка для зʼєднання й ремонту мембран і плівок. Ціна за м.п.; у пропозиціях — за рулон.",
    rule: {
      groups: ["tape"], norm: "roll_mp",
      all: [TAPE_WORD, "мембран|пароізол|парои|пароб|плівок|пленок|eurovent|strotex|juta|ютафол|topband|uniband|unoband"],
      none: "алюмін|алюмин|фольг|малярн|димох|дымоход|ущільн|уплотн|бітум|битум|примик|примык|звукоізол|демпфер|фундамент|ванн|душ", min: 1, max: 250,
    },
  },
].map((m) => ({ ...m, category: "Плівки, мембрани, стрічки" }));

const windows = [
  {
    name: "Вікно металопластикове Екіпаж Ultra 72 (профіль 72 мм), 2-камерний склопакет", category: "Вікна і двері", unit: "м²",
    spec: "EKIPAZH Ultra 72: профіль 72 мм, 5 камер, склопакет 4-10-4-10-4і (3 скла). Ціна за м² без монтажу — з прайсу oknaekipazh.com.ua, оновлюємо вручну.", rule: null,
  },
  {
    name: "Двері вхідні металопластикові Екіпаж Ultra 72 (профіль 72 мм), 2-камерний склопакет", category: "Вікна і двері", unit: "м²",
    spec: "EKIPAZH Ultra 72 (COMFORT): профіль 72 мм, двері 900×2100 зі склопакетом 4-10-4-10-4i. Ціна за м² без монтажу — з прайсу oknaekipazh.com.ua, оновлюємо вручну.", rule: null,
  },
];

const osb = [9, 10, 12, 15, 18, 22].map((th) => ({
  name: `OSB-3 ${th} мм`, category: "Оздоблення", unit: "м²",
  spec: `Плита OSB-3 ${th} мм для чорнового оздоблення. Ціна за м²; у пропозиціях — за лист.`,
  rule: { groups: ["osb"], norm: "sheet_m2", thickness: th, all: ["osb|осб"], none: "шпунт|qsb|ламін|ламин|гонт|черепиц|обрізк|обрезк", min: 60, max: 1500 },
}));
const plywood = [[9, 10], [12, 12], [15, 15], [18, 18]].map(([lo, hi]) => ({
  name: `Фанера ${lo === hi ? lo : `${lo}–${hi}`} мм`, category: "Оздоблення", unit: "м²",
  spec: "Фанера ФК/ФСФ шліфована. Ціна за м² — серединна серед знайдених (ґатунки різні — дивись пропозиції).",
  rule: { groups: ["plywood"], norm: "sheet_m2", thickness: lo === hi ? lo : [lo, hi], agg: "median", all: ["фанер"], none: "ламін|ламин|транспорт|перфор|гнучк|гибк|шпон|обрізк|обрезк|двп|мдф|осб|osb", min: 100, max: 4000 },
}));
const finish = [
  ...osb,
  ...plywood,
  {
    name: "Імітація бруса", category: "Оздоблення", unit: "м²",
    spec: "Обшивальна дошка «імітація бруса» (сосна/ялина). Ціна за м²; у пропозиціях — за штуку й м.п.",
    rule: { groups: ["cladding"], norm: "board_m2", all: ["імітац|имитац|фальш.?брус"], none: "куток|уголок|плінтус|плинтус|наличник|кліпс|кляймер", min: 150, max: 3000 },
  },
  {
    name: "Планкен скошений", category: "Оздоблення", unit: "м²",
    spec: "Планкен зі скошеною кромкою — для фасаду й інтерʼєру. Ціна за м²; у пропозиціях — за штуку й м.п.",
    rule: { groups: ["cladding"], norm: "board_m2", all: ["планкен"], none: "прям|кріплен|креплен|кліпс|кляймер|саморіз|саморез|термо|модрин|лиственн", min: 200, max: 5000 },
  },
  {
    name: "Гіпсокартон стіновий 12,5 мм", category: "Оздоблення", unit: "м²",
    spec: "Стандартний ГКЛ 12,5 мм. Ціна за м²; у пропозиціях — за лист.",
    rule: { groups: ["drywall"], norm: "sheet_m2", thickness: 12.5, all: ["гіпсокартон|гипсокартон|гкл|гкп"], none: "вологост|влагост|вогнест|огнест|профіл|профил|клей|саморіз|саморез|стрічк|лента|дюбел|арков|гнучк|гибк|шпакл|акуст", min: 40, max: 600 },
  },
  {
    name: "Гіпсокартон вологостійкий 12,5 мм", category: "Оздоблення", unit: "м²",
    spec: "Вологостійкий ГКЛВ 12,5 мм. Ціна за м²; у пропозиціях — за лист.",
    rule: { groups: ["drywall"], norm: "sheet_m2", thickness: 12.5, all: ["гіпсокартон|гипсокартон|гкл|гкп", "вологост|влагост"], none: "вогнест|огнест|профіл|профил|клей|саморіз|саморез|стрічк|лента|дюбел|шпакл", min: 40, max: 800 },
  },
];

const roof = [
  {
    name: "ПВХ мембрана армована 1,5 мм", unit: "м²",
    spec: "Покрівельна ПВХ мембрана, армована поліестером, 1,5 мм. Ціна за м²; у пропозиціях — за рулон.",
    rule: { groups: ["roof_pvc"], norm: "roll_m2", thickness: [1.45, 1.55], all: ["пвх|pvc", "мембран"], none: "басейн|бассейн|ставк|пруд|неармов", min: 100, max: 1200 },
  },
  {
    name: "Геотекстиль 300–500 г/м² (підкладка під мембрану)", unit: "м²",
    spec: "Голкопробивний геотекстиль як розділювальний шар під ПВХ мембрану. Ціна за м².",
    rule: { groups: ["geotextile"], norm: "roll_m2", density: [280, 520], all: ["геотекстил"], min: 8, max: 250 },
  },
].map((m) => ({ ...m, category: "Покрівля" }));

const consumables = [
  {
    name: "Скоби для степлера", unit: "1000 шт",
    spec: "Скоби для монтажу плівок і мембран (тип 53/140, 8–14 мм). Серединна ціна за 1000 шт.",
    rule: { groups: ["staples"], norm: "piece", per: 1000, agg: "median", all: ["скоб"], none: "такелаж|будівельн|строительн|кабел|канцеляр|антистеплер|кріплен|креплен|труб|№ ?(10|24|26)\\b", min: 15, max: 1500 },
  },
  {
    name: "Цвяхи для пневмопістолета", unit: "1000 шт",
    spec: "Цвяхи в касетах/барабанах для пневматичних нейлерів. Серединна ціна за 1000 шт.",
    rule: { groups: ["nails"], norm: "piece", per: 1000, agg: "median", all: ["цвях|гвозд", "пневм|барабан|реєчн|реечн|пістолет|пистолет|нейлер|обойм|касет|кассет"], min: 30, max: 5000 },
  },
  {
    name: "Шурупи конструкційні", unit: "100 шт",
    spec: "Конструкційні шурупи по дереву (розміри різні — дивись пропозиції). Серединна ціна за 100 шт.",
    rule: { groups: ["screws"], norm: "piece", per: 100, agg: "median", all: ["конструкц", "шуруп|саморіз|саморез|гвинт|винт"], min: 20, max: 20000 },
  },
  {
    name: "Рукавиці робочі", unit: "пара",
    spec: "Трикотажні робочі рукавиці з покриттям. Серединна ціна за пару.",
    rule: { groups: ["gloves"], norm: "piece", agg: "median", all: ["рукавиц|рукавич|перчат"], none: "зварюв|сварщ|діелектр|диэлектр|одноразов|кухон|садов|зимов|утепл|спилк|краг|набір|набор|латексні 100|нітрилові 100|медич", min: 8, max: 250 },
  },
  {
    name: "Олівець будівельний", unit: "шт",
    spec: "Столярний/будівельний олівець. Серединна ціна за штуку.",
    rule: { groups: ["pencil"], norm: "piece", agg: "median", all: ["олів[еє]?ц|карандаш", "будів|строит|столяр|тесляр|плотн|муляр|каменщ"], none: "точилк|стругалк", min: 3, max: 300 },
  },
  {
    name: "Пензель малярний", unit: "шт",
    spec: "Плоский малярний пензель (розміри різні). Серединна ціна за штуку.",
    rule: { groups: ["brush"], norm: "piece", agg: "median", all: ["пензел|пензл|кисть|кисти|кисточ"], none: "макловиц|набір|набор|художн|радіатор|радиатор|щітк|щетк", min: 8, max: 600 },
  },
  {
    name: "Макловиця", unit: "шт",
    spec: "Макловиця для ґрунтування й просочення. Серединна ціна за штуку.",
    rule: { groups: ["brush"], norm: "piece", agg: "median", all: ["макловиц"], none: "набір|набор", min: 20, max: 900 },
  },
].map((m) => ({ ...m, category: "Витратні матеріали" }));

const mesh = [
  {
    name: "Сітка металева, вічко до 6×6 мм (захист від гризунів)", category: "Сітки та захист", unit: "м²",
    spec: "Зварна/ткана оцинкована сітка з вічком не більше 6×6 мм — під будинок. Ціна за м²; у пропозиціях — за рулон.",
    rule: { groups: ["mesh"], norm: "roll_m2", cell_max: 6.5, all: ["сітк|сетк", "зварн|сварн|оцинк|метал|ткан|нержав|просічн|просечн|цпвс|сталев|стальн"], none: "пластик|склосіт|стеклосет|скловолок|стекловолок|полімер|полимер|композит|москіт|москит|абразив|фасадн|затін|затен|маскув|маскир|серпянк|малярн", min: 15, max: 2500 },
  },
];

export const CATEGORIES = [
  { name: "Дерево", icon: "🪵" },
  { name: "Утеплювач", icon: "🧱" },
  { name: "Плівки, мембрани, стрічки", icon: "🧻" },
  { name: "Вікна і двері", icon: "🪟" },
  { name: "Оздоблення", icon: "🎨" },
  { name: "Покрівля", icon: "🏠" },
  { name: "Витратні матеріали", icon: "🧰" },
  { name: "Сітки та захист", icon: "🕸️" },
];

export const UNITS = ["пара", "100 шт", "1000 шт"];

export const MATERIALS = [...lumber, ...wool, ...films, ...windows, ...finish, ...roof, ...consumables, ...mesh];

// пошук на сайті як джерело — для товарів без власної категорії
const q = (words) => `https://epicentrk.ua/ua/search/?q=${encodeURIComponent(words)}`;

// магазин → група → сторінки категорій
export const SOURCES = {
  epicentr: {
    lumber: ["https://epicentrk.ua/ua/shop/brusy-doski-i-reyki/"],
    wool: ["https://epicentrk.ua/ua/shop/bazaltovaya-i-mineralnaya-vata/"],
    membrane: ["https://epicentrk.ua/ua/shop/krovelnye-plenki-i-membrany/"],
    tape: ["https://epicentrk.ua/ua/shop/krovelnye-lenty/", "https://epicentrk.ua/ua/shop/lenty-stroitelno-montazhnye/", "https://epicentrk.ua/ua/shop/kleykie-lenty/"],
    osb: ["https://epicentrk.ua/ua/shop/osb-plity/"],
    plywood: ["https://epicentrk.ua/ua/shop/fanera/"],
    drywall: ["https://epicentrk.ua/ua/shop/gipsokarton/"],
    cladding: ["https://epicentrk.ua/ua/shop/vagonka/", "https://epicentrk.ua/ua/shop/brusy-doski-i-reyki/fs/typ-tovaru-falsh-brus/", q("планкен"), q("імітація бруса")],
    roof_pvc: [q("пвх мембрана покрівельна")],
    geotextile: [q("геотекстиль")],
    staples: ["https://epicentrk.ua/ua/shop/skoby-dlya-steplera/"],
    nails: ["https://epicentrk.ua/ua/shop/gvozdi/"],
    screws: ["https://epicentrk.ua/ua/shop/shurupy/"],
    gloves: ["https://epicentrk.ua/ua/shop/rukavitsy-i-perchatki-stroitelnye/"],
    pencil: [q("олівець столярний")],
    brush: ["https://epicentrk.ua/ua/shop/kisti-malyarnye/"],
    mesh: ["https://epicentrk.ua/ua/shop/setka-svarnaya/", q("сітка оцинкована 6х6"), q("сітка від гризунів")],
  },
  oldi: {
    lumber: ["https://oldimarket.com.ua/category/doshky/", "https://oldimarket.com.ua/category/brusy/"],
    wool: ["https://oldimarket.com.ua/category/vata_izolyatsiyna/"],
    membrane: ["https://oldimarket.com.ua/category/pokrivelni_plivky/", "https://oldimarket.com.ua/category/plivky_budivelni/"],
    tape: ["https://oldimarket.com.ua/category/pokrivelni_strichky/", "https://oldimarket.com.ua/category/strichky_kleyki_skotch/"],
    osb: ["https://oldimarket.com.ua/category/plyty_osb/"],
    plywood: ["https://oldimarket.com.ua/category/fanera/"],
    drywall: ["https://oldimarket.com.ua/category/hipsokarton/"],
    cladding: ["https://oldimarket.com.ua/category/vahonka/"],
    staples: ["https://oldimarket.com.ua/category/skoby/"],
    nails: ["https://oldimarket.com.ua/category/tsvyakhy/"],
    screws: ["https://oldimarket.com.ua/category/shurupy/", "https://oldimarket.com.ua/category/samorizy/"],
    gloves: ["https://oldimarket.com.ua/category/rukavytsi/"],
    brush: ["https://oldimarket.com.ua/category/penzli_maklovytsi/"],
    pencil: ["https://oldimarket.com.ua/category/olivtsi_markery/"],
    mesh: ["https://oldimarket.com.ua/category/sitka_v_rulonakh/", "https://oldimarket.com.ua/category/sitka_dlya_ohorozhi/"],
  },
  budia: {
    lumber: ["https://budia.ua/armatura-brus-doska", "https://budia.ua/svezhepil-strogannyi"],
    wool: ["https://budia.ua/penoplast-stirodur-vata"],
    membrane: ["https://budia.ua/setki", "https://budia.ua/krovlia"],
    osb: ["https://budia.ua/osb"],
    plywood: ["https://budia.ua/osb"],
    drywall: ["https://budia.ua/gipsokarton"],
    mesh: ["https://budia.ua/setki"],
  },
  kub: {
    lumber: ["https://kub.in.ua/leso-pilomaterialy/brus/", "https://kub.in.ua/leso-pilomaterialy/doska/"],
    wool: ["https://kub.in.ua/uteplitel/mineralnaya-vata/"],
    osb: ["https://kub.in.ua/leso-pilomaterialy/osb-i-qsb/"],
    plywood: ["https://kub.in.ua/leso-pilomaterialy/fanera/"],
    drywall: ["https://kub.in.ua/gipsokarton-i-profil/gipsokarton/"],
    nails: ["https://kub.in.ua/krepezh/gvozdi/"],
    screws: ["https://kub.in.ua/krepezh/samorezy/samorezy-po-derevu/"],
  },
  budmaterial: {
    lumber: ["https://budmaterial.kyiv.ua/pylomaterialy/"],
    wool: ["https://budmaterial.kyiv.ua/materialy-dlya-uteplennya/mineralna-vata/"],
    membrane: ["https://budmaterial.kyiv.ua/pokrivelni-materialy/membrany-baryery/"],
    osb: ["https://budmaterial.kyiv.ua/pylomaterialy/plyty-osb/"],
    drywall: ["https://budmaterial.kyiv.ua/gipsokartonni-systemy/"],
  },
  m2: {
    lumber: ["https://m2.org.ua/pylomaterialy/doshka/doshka-obrizna", "https://m2.org.ua/pylomaterialy/brus"],
    wool: ["https://m2.org.ua/utepljuvach/mineralna-vata"],
    membrane: ["https://m2.org.ua/utepljuvach/gidrobarier", "https://m2.org.ua/utepljuvach/parobarier", "https://m2.org.ua/pokrivelni-materialy/paroizoljatsija-ta-gidroizoljatsija"],
    tape: ["https://m2.org.ua/budivelnyi-inventar/vytratni-materialy/budivelnyi-skotch", "https://m2.org.ua/budivelnyi-inventar/vytratni-materialy/strichka"],
    osb: ["https://m2.org.ua/pylomaterialy/osb"],
    plywood: ["https://m2.org.ua/pylomaterialy/fanera"],
    drywall: ["https://m2.org.ua/gipsokartonni-systemy/gipsokarton"],
    geotextile: ["https://m2.org.ua/dvir-i-gorod/geotekstyl"],
    staples: ["https://m2.org.ua/budivelnyi-inventar/ruchnyi-instrument/budivelnyi-stepler-ruchnyi/skoby-dlja-steplera"],
    nails: ["https://m2.org.ua/kriplennja/tsvjakhy"],
    screws: ["https://m2.org.ua/kriplennja/shurupy", "https://m2.org.ua/kriplennja/samonarizy/samorizy-po-derevu"],
    gloves: ["https://m2.org.ua/budivelnyi-inventar/rukavychky-i-rukavytsi"],
    brush: ["https://m2.org.ua/budivelnyi-inventar/maljarnyi-instrument"],
    mesh: ["https://m2.org.ua/metalevi-sitky/sitka-zvarna", "https://m2.org.ua/kutnyky-majaky-sitka/sitka-shtukaturna"],
  },
};

// виробники пиломатеріалів (знайдені пошуком 01.10.2026): продають і свіжопиляну, і суху нестругану деревину
const aw = (slug) => `https://www.alba-wood.com.ua/${slug}?limit=100`;
SOURCES.woodmax = {
  lumber: ["https://woodmax.ua/cat/obreznaya-doska/", "https://woodmax.ua/cat/strogonnaya-doska/"],
};
SOURCES.albawood = {
  lumber: [aw("brus-obriznyj"), aw("doshka-obrizna"), aw("rejka-obrizna"), aw("brus-suhyj"), aw("doshka-suha-obrizna"), aw("doshka-suha-strugana"), aw("brus-suhyj-struganyj")],
};

// Магазини, чиї сайти не пускають програми: парсер їх не обходить, сторінки надсилає людина зі свого браузера (/capture).
// Тут — які сторінки варто надсилати (адреси з відкритих карт сайтів).
const lm = (slug) => `https://www.leroymerlin.ua/f/${slug}`;
const an = (slug) => `https://angio.com.ua/ua/ishop/${slug}/`;
export const CAPTURE_SOURCES = {
  leroymerlin: {
    lumber: [lm("doshky"), lm("brus-ta-reiky")],
    wool: [lm("bazaltova-vata")],
    membrane: [lm("superdyfuziina-membrana"), lm("paroizoliatsiini-plivky")],
    tape: [lm("aliuminiieva-strichka"), lm("pokrivelni-strichky")],
    osb: [lm("osb-plyty")],
    plywood: [lm("fanera")],
    drywall: [lm("gipsokarton")],
    cladding: [lm("dereviana-vagonka")],
    staples: [lm("skoby-ta-gvizdky-dlia-pnevmoinstrumentu")],
    nails: [lm("tsviakhy")],
    screws: [lm("shurupy")],
    gloves: [lm("rukavychky")],
    brush: [lm("penzli-maliarni")],
    pencil: [lm("rozmitochni-instrumenty-olivtsi-markery-kreida")],
    mesh: [lm("sitka-metaleva")],
  },
  angio: {
    lumber: [an("doska_obreznaya"), an("brus")],
    wool: [an("bazaltovaya_vata")],
    membrane: [an("izoliacionnye_plenki")],
    tape: [an("lenty-germetiki")],
    osb: [an("osb")],
    plywood: [an("fanera")],
    drywall: [an("gipsokarton")],
    cladding: [an("vagonka")],
    geotextile: [an("geotekstil")],
    nails: [an("gvozdi")],
    screws: [an("shurupy")],
    gloves: [an("perchatki")],
    brush: [an("malyarnyy_instrument/kisti"), an("malyarnyy_instrument/maklovicy")],
    mesh: [an("metallicheskaya_setka")],
  },
};

// Скільки сторінок категорії проходити. Для дрібниці (рукавиці, пензлі, скоби) досить вибірки з перших сторінок:
// там ціна серединна, а категорії у великих магазинах — на тисячі товарів.
const GROUP_PAGES = { gloves: 3, brush: 3, staples: 3, nails: 4, screws: 4, pencil: 2, tape: 6, roof_pvc: 3, geotextile: 3 };
export const maxPages = (site, grp, url = "") => (url.includes("/search/") ? 2 : GROUP_PAGES[grp] ?? (site === "epicentr" ? 25 : 15));
