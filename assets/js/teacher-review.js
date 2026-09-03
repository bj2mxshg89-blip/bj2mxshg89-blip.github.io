import { getAccountContext } from "./supabase-client.js?v=13";

const elements = Object.fromEntries([
  "reviewLoading", "reviewError", "reviewErrorText", "reviewApp", "reviewHome", "reviewStage",
  "reviewToolbar", "reviewProgress", "reviewTitle", "reviewLead", "reviewStats", "reviewTopics",
  "startTheory", "startQuiz", "startHard", "reviewPrev", "reviewReveal", "reviewNext",
  "reviewRandom", "reviewTimer"
].map((id) => [id, document.getElementById(id)]));

const subjects = {
  biology: {
    title: "Биология за 5 класс",
    lead: "Признаки живого, методы исследования, клетка, группы организмов, среды обитания, природные сообщества и пищевые связи.",
    stats: [["6", "опорных блоков"], ["34", "вопроса для блица"], ["45 сек", "на устный ответ"]],
    topics: [
      ["Живое и наука", "Признаки живого, биология и методы исследования."],
      ["Клетка и организм", "Микроскоп, строение клетки, одноклеточные и многоклеточные."],
      ["Группы организмов", "Растения, животные, грибы, бактерии и вирусы."],
      ["Среды обитания", "Водная, наземно-воздушная, почвенная и организменная."],
      ["Сообщества и связи", "Пищевые цепи и взаимоотношения организмов."],
      ["Человек и природа", "Искусственные сообщества, влияние человека, охрана природы."]
    ],
    slides: [
      {topic:0,kicker:"Живая и неживая природа",title:"Живое определяется совокупностью признаков",body:`<div class="review-facts"><div class="review-fact"><strong>Обмен веществ</strong>Питание, дыхание, выделение.</div><div class="review-fact"><strong>Рост и развитие</strong>Организм изменяется в течение жизни.</div><div class="review-fact"><strong>Размножение</strong>Образование новых организмов.</div><div class="review-fact"><strong>Раздражимость</strong>Реакция на изменения окружающей среды.</div></div><div class="review-tip"><b>Важно:</b> один отдельный признак ещё не доказывает, что объект живой. Кристалл может расти, но не обладает всей совокупностью признаков живого.</div>`},
      {topic:0,kicker:"Биология",title:"Биология — система наук о живой природе",body:`<div class="review-facts"><div class="review-fact"><strong>Ботаника</strong>Растения.</div><div class="review-fact"><strong>Зоология</strong>Животные.</div><div class="review-fact"><strong>Микология</strong>Грибы.</div><div class="review-fact"><strong>Цитология</strong>Клетки.</div><div class="review-fact"><strong>Микробиология</strong>Микроорганизмы.</div><div class="review-fact"><strong>Экология</strong>Связи организмов между собой и средой.</div></div>`},
      {topic:0,kicker:"Методы",title:"Наблюдение и эксперимент — не одно и то же",body:`<div class="review-facts"><div class="review-fact"><strong>Наблюдение</strong>Исследователь фиксирует происходящее, не меняя условия специально.</div><div class="review-fact"><strong>Измерение</strong>Получение количественных данных.</div><div class="review-fact"><strong>Эксперимент</strong>Условие специально изменяют и оценивают результат.</div><div class="review-fact"><strong>Сравнение</strong>Выявляют сходства и различия.</div></div><div class="review-tip"><b>Хороший эксперимент:</b> меняем один фактор, остальные условия стараемся сохранить одинаковыми.</div>`},
      {topic:0,kicker:"Логика исследования",title:"Вопрос → гипотеза → опыт → результат → вывод",body:`Например: влияет ли свет на рост растения?<ul><li>берём два максимально одинаковых растения;</li><li>меняем только освещение;</li><li>полив, температура и почва остаются одинаковыми;</li><li>измеряем рост;</li><li>сравниваем результаты и формулируем вывод.</li></ul>`},
      {topic:1,kicker:"Увеличительные приборы",title:"Лупа и микроскоп помогают увидеть то, что не видно глазом",body:`Основные элементы светового микроскопа: окуляр, объектив, тубус, предметный столик, источник света, винты настройки.<div class="review-formula">Общее увеличение = увеличение окуляра × увеличение объектива</div><div class="review-tip">Окуляр ×10 и объектив ×40 дают увеличение ×400.</div>`},
      {topic:1,kicker:"Клетка",title:"Клетка — основная единица строения живого",body:`<div class="review-facts"><div class="review-fact"><strong>Мембрана</strong>Отделяет клетку от среды и регулирует обмен.</div><div class="review-fact"><strong>Цитоплазма</strong>Внутренняя среда клетки.</div><div class="review-fact"><strong>Ядро</strong>Содержит наследственную информацию и участвует в управлении клеткой.</div></div>`},
      {topic:1,kicker:"Растительная клетка",title:"У растительной клетки есть характерные структуры",body:`<div class="review-facts"><div class="review-fact"><strong>Клеточная стенка</strong>Придаёт прочность и форму.</div><div class="review-fact"><strong>Хлоропласты</strong>Содержат хлорофилл; здесь идёт фотосинтез.</div><div class="review-fact"><strong>Вакуоль</strong>Содержит клеточный сок.</div></div><div class="review-tip">Хлоропласты есть не во всех клетках растения. В клетках корня их обычно нет.</div>`},
      {topic:1,kicker:"Организм",title:"Одна клетка тоже может быть целым организмом",body:`<div class="review-facts"><div class="review-fact"><strong>Одноклеточные</strong>Одна клетка выполняет все основные жизненные функции.</div><div class="review-fact"><strong>Многоклеточные</strong>Клеток много; они специализируются и работают совместно.</div></div>`},
      {topic:2,kicker:"Разнообразие организмов",title:"Растения, животные, грибы и бактерии различаются способом жизни",body:`<div class="review-facts"><div class="review-fact"><strong>Растения</strong>Большинство способно к фотосинтезу.</div><div class="review-fact"><strong>Животные</strong>Питаются готовыми органическими веществами.</div><div class="review-fact"><strong>Грибы</strong>Не имеют хлорофилла и питаются готовой органикой.</div><div class="review-fact"><strong>Бактерии</strong>Одноклеточные организмы, встречаются почти повсюду.</div></div>`},
      {topic:2,kicker:"Растения",title:"Растения и фотосинтезируют, и дышат",body:`Фотосинтез использует энергию света для образования органических веществ. Дыхание — другой процесс, связанный с высвобождением энергии.<div class="review-tip"><b>Типичная ошибка:</b> «растения не дышат». Дышат — и днём, и ночью.</div>`},
      {topic:2,kicker:"Грибы, бактерии, вирусы",title:"Маленькие и неподвижные — не значит одинаковые",body:`<div class="review-facts"><div class="review-fact"><strong>Грибы</strong>Особая группа организмов, не растения.</div><div class="review-fact"><strong>Бактерии</strong>Бывают полезными и болезнетворными.</div><div class="review-fact warm"><strong>Вирусы</strong>Не имеют клеточного строения и размножаются только внутри клетки-хозяина.</div></div>`},
      {topic:3,kicker:"Среда обитания",title:"Четыре основные среды жизни",body:`<div class="review-facts"><div class="review-fact"><strong>Водная</strong>Рыбы, медузы, многие водоросли.</div><div class="review-fact"><strong>Наземно-воздушная</strong>Большинство наземных растений и животных.</div><div class="review-fact"><strong>Почвенная</strong>Дождевые черви, многие микроорганизмы.</div><div class="review-fact"><strong>Организменная</strong>Другой организм служит средой обитания.</div></div>`},
      {topic:3,kicker:"Приспособления",title:"Строение организма связано с условиями среды",body:`Вода поддерживает тело, но создаёт сопротивление движению. На суше много кислорода, зато организмам приходится сохранять воду и поддерживать массу тела. В почве мало света и ограничено пространство.<div class="review-tip">Поэтому у рыбы обтекаемая форма, а у многих почвенных животных хорошо развито осязание.</div>`},
      {topic:4,kicker:"Природное сообщество",title:"Лес — это не просто множество деревьев",body:`Природное сообщество — совокупность организмов разных видов, совместно обитающих на территории и связанных между собой.<div class="review-facts"><div class="review-fact"><strong>Хищничество</strong>Хищник ловит и поедает добычу.</div><div class="review-fact"><strong>Паразитизм</strong>Паразит живёт за счёт хозяина.</div><div class="review-fact"><strong>Конкуренция</strong>Организмы используют один ограниченный ресурс.</div><div class="review-fact"><strong>Взаимовыгодные связи</strong>Оба участника получают пользу.</div></div>`},
      {topic:4,kicker:"Пищевые связи",title:"Стрелка показывает передачу вещества и энергии",body:`<div class="review-formula">трава → кузнечик → лягушка → уж</div><div class="review-facts"><div class="review-fact"><strong>Производители</strong>Зелёные растения.</div><div class="review-fact"><strong>Потребители</strong>Организмы, питающиеся готовой органикой.</div><div class="review-fact"><strong>Разрушители</strong>Прежде всего грибы и бактерии.</div></div>`},
      {topic:5,kicker:"Искусственные сообщества",title:"Поле и сад требуют постоянного участия человека",body:`Природные сообщества способны длительно существовать без постоянного управления человеком. Искусственные — поле, сад, огород, аквариум — обычно требуют ухода.<div class="review-tip">Если поле забросить, постепенно начнётся естественная смена сообщества.</div>`},
      {topic:5,kicker:"Охрана природы",title:"Человек может и разрушать, и восстанавливать",body:`<div class="review-facts"><div class="review-fact warm"><strong>Отрицательное влияние</strong>Загрязнение, вырубка, разрушение мест обитания.</div><div class="review-fact"><strong>Положительное влияние</strong>Заповедники, восстановление лесов, очистка воды, охрана редких видов.</div></div><div class="review-tip"><b>Красная книга</b> содержит сведения о редких и находящихся под угрозой исчезновения видах.</div>`}
    ],
    questions: [
      ["Живое","Назовите не менее трёх признаков живых организмов.","Питание, дыхание, рост, развитие, размножение, обмен веществ, реакция на раздражители, клеточное строение и др."],
      ["Живое","Почему растение считается живым, хотя оно не ходит и не бегает?","Движение — не единственный признак живого. Растение обладает совокупностью признаков живого.",true],
      ["Живое","Кристалл соли увеличивается в размерах. Значит ли это, что он живой?","Нет. Одного роста недостаточно: нет всей совокупности признаков живого.",true],
      ["Биология","Что изучает ботаника?","Растения."],
      ["Биология","Какая наука изучает клетки?","Цитология."],
      ["Методы","Чем наблюдение отличается от эксперимента?","В эксперименте исследователь специально изменяет условие; при наблюдении — нет.",true],
      ["Методы","Ученик ежедневно измеряет длину проростка. Какой метод он использует?","Измерение."],
      ["Методы","Почему нельзя одновременно менять в опыте освещение, полив и температуру?","Невозможно будет понять, какой фактор вызвал результат.",true],
      ["Методы","Чем результат отличается от вывода?","Результат — полученные данные; вывод — их объяснение и смысл.",true],
      ["Микроскоп","Окуляр ×10, объектив ×40. Каково общее увеличение?","×400."],
      ["Клетка","Что является основной единицей строения живого?","Клетка."],
      ["Клетка","Какова роль ядра?","Хранение наследственной информации и участие в управлении клеткой."],
      ["Клетка","Где в растительной клетке происходит фотосинтез?","В хлоропластах."],
      ["Клетка","Может ли одна клетка быть целым организмом?","Да. Существуют одноклеточные организмы."],
      ["Растения","Правда ли, что растения только фотосинтезируют и не дышат?","Нет. Растения и фотосинтезируют, и дышат.",true],
      ["Грибы","Почему грибы нельзя относить к растениям?","Они не имеют хлорофилла, не фотосинтезируют и питаются готовыми органическими веществами.",true],
      ["Бактерии","Все ли бактерии вредны?","Нет. Многие бактерии полезны и необходимы экосистемам и человеку."],
      ["Вирусы","Чем вирус принципиально отличается от бактерии?","Вирус не имеет клеточного строения и размножается только внутри клетки-хозяина.",true],
      ["Среды","Назовите четыре основные среды обитания.","Водная, наземно-воздушная, почвенная, организменная."],
      ["Среды","Почему у большинства рыб обтекаемая форма тела?","Она уменьшает сопротивление воды при движении.",true],
      ["Среды","Почему в почве зрение многим животным менее важно, чем осязание?","В почве мало света, поэтому зрение малоэффективно.",true],
      ["Среды","Что означает «организм как среда обитания»?","Один организм служит местом жизни для другого, например паразита."],
      ["Сообщества","Что называется природным сообществом?","Совокупность организмов разных видов, совместно живущих на территории и связанных между собой."],
      ["Сообщества","Почему лес — это не просто набор деревьев?","В нём взаимодействуют растения, животные, грибы, микроорганизмы и условия среды.",true],
      ["Связи","Что такое конкуренция?","Использование организмами одного и того же ограниченного ресурса."],
      ["Связи","Чем паразитизм отличается от хищничества?","Паразит обычно длительно живёт за счёт хозяина; хищник ловит и поедает добычу.",true],
      ["Пищевая цепь","В цепи трава → кузнечик → лягушка → уж кто производитель?","Трава."],
      ["Пищевая цепь","Что показывают стрелки в пищевой цепи?","Направление передачи вещества и энергии — от пищи к потребителю.",true],
      ["Пищевая цепь","Что может произойти с кузнечиками, если резко уменьшится число лягушек?","Вероятнее всего их численность увеличится.",true],
      ["Пищевая цепь","Почему исчезновение одного вида может повлиять на многие другие?","Организмы связаны пищевыми и другими экологическими связями.",true],
      ["Сообщества","Чем искусственное сообщество отличается от природного?","Создаётся или поддерживается человеком и обычно требует ухода."],
      ["Сообщества","Что произойдёт с полем, если его не обрабатывать много лет?","Начнётся естественная смена сообщества: другие травы, кустарники, затем возможно деревья.",true],
      ["Охрана природы","Для чего создают заповедники?","Для сохранения природных комплексов, редких видов и естественных процессов."],
      ["Охрана природы","Для чего нужна Красная книга?","Для учёта редких и исчезающих видов и организации их охраны."]
    ]
  },

  geography: {
    title: "География за 5 класс",
    lead: "Карта и план, масштаб, азимут, градусная сеть, координаты, движения Земли, литосфера и рельеф.",
    stats: [["6", "опорных блоков"], ["36", "вопросов для блица"], ["45 сек", "на устный ответ"]],
    topics: [
      ["География и открытия", "Что изучает география, методы и путешествия."],
      ["План и масштаб", "Условные знаки, масштаб и высоты."],
      ["Ориентирование", "Стороны горизонта, компас и азимут."],
      ["Карта и координаты", "Параллели, меридианы, широта и долгота."],
      ["Земля как планета", "Вращение, обращение вокруг Солнца и освещённость."],
      ["Литосфера и рельеф", "Строение Земли, плиты, вулканы, землетрясения, рельеф."]
    ],
    slides: [
      {topic:0,kicker:"География",title:"Что изучает география?",body:`География изучает Землю, географические объекты, процессы и явления, их размещение и взаимосвязи.<div class="review-facts"><div class="review-fact"><strong>Объекты</strong>Материк, океан, река, гора, город, страна.</div><div class="review-fact"><strong>Процессы и явления</strong>Землетрясение, извержение вулкана, движение плит, смена дня и ночи.</div></div>`},
      {topic:0,kicker:"Методы",title:"Географ изучает Землю не только в путешествии",body:`Наблюдения, измерения, карты, описания, статистика, спутниковые снимки и цифровые геоинформационные системы позволяют изучать территорию даже дистанционно.`},
      {topic:0,kicker:"Путешествия",title:"Кого важно помнить?",body:`<div class="review-facts"><div class="review-fact"><strong>Афанасий Никитин</strong>Путешествие в Индию.</div><div class="review-fact"><strong>Христофор Колумб</strong>В 1492 году достиг берегов Америки.</div><div class="review-fact"><strong>Экспедиция Магеллана</strong>Первое кругосветное плавание.</div><div class="review-fact"><strong>Беллинсгаузен и Лазарев</strong>Экспедиция, связанная с открытием Антарктиды.</div></div>`},
      {topic:1,kicker:"План местности",title:"План — уменьшенное изображение небольшого участка сверху",body:`На плане используются условные знаки, масштаб, направления и обозначения высот. Условные знаки позволяют точно и компактно показывать объекты.`},
      {topic:1,kicker:"Масштаб",title:"Масштаб показывает степень уменьшения",body:`<div class="review-formula">1 : 100 000 → 1 см на карте = 100 000 см = 1 км на местности</div><div class="review-tip"><b>Запомнить:</b> чем меньше знаменатель, тем крупнее масштаб и тем больше деталей можно показать.</div>`},
      {topic:1,kicker:"Высота",title:"Абсолютная и относительная высота",body:`<div class="review-facts"><div class="review-fact"><strong>Абсолютная</strong>Высота точки относительно уровня моря.</div><div class="review-fact"><strong>Относительная</strong>Превышение одной точки над другой.</div></div><div class="review-formula">1200 м − 500 м = 700 м</div>`},
      {topic:2,kicker:"Ориентирование",title:"Основные и промежуточные стороны горизонта",body:`Север, юг, запад, восток; северо-восток, северо-запад, юго-восток, юго-запад. Компас позволяет точно определить направление на север.`},
      {topic:2,kicker:"Азимут",title:"Азимут отсчитывают от севера по часовой стрелке",body:`<div class="review-formula">Север 0° · Восток 90° · Юг 180° · Запад 270°</div><div class="review-tip">Северо-восток примерно соответствует 45°.</div>`},
      {topic:3,kicker:"Глобус и карта",title:"Плоская карта мира неизбежно содержит искажения",body:`Глобус — объёмная модель Земли. Карта — изображение земной поверхности на плоскости. Сферическую поверхность нельзя перенести на плоскость без искажений.`},
      {topic:3,kicker:"Градусная сеть",title:"Параллели и меридианы задают положение точки",body:`<div class="review-facts"><div class="review-fact"><strong>Параллели</strong>Параллельны экватору, направление запад—восток. Экватор — самая длинная параллель.</div><div class="review-fact"><strong>Меридианы</strong>Соединяют Северный и Южный полюса, направление север—юг.</div></div><div class="review-formula">Экватор = 0° широты · Гринвич = 0° долготы</div>`},
      {topic:3,kicker:"Координаты",title:"Сначала широта, потом долгота",body:`<div class="review-facts"><div class="review-fact"><strong>Широта</strong>От экватора: северная или южная, 0–90°.</div><div class="review-fact"><strong>Долгота</strong>От нулевого меридиана: восточная или западная, 0–180°.</div></div><div class="review-formula">55° с. ш., 37° в. д.</div>`},
      {topic:4,kicker:"Земля как планета",title:"У Земли два движения, которые важно не путать",body:`<div class="review-facts"><div class="review-fact"><strong>Вращение вокруг оси</strong>≈ 24 часа → смена дня и ночи.</div><div class="review-fact"><strong>Обращение вокруг Солнца</strong>≈ 365 суток и 6 часов.</div></div><div class="review-tip"><b>Смена времён года</b> связана с обращением Земли вокруг Солнца и наклоном земной оси.</div>`},
      {topic:4,kicker:"Освещённость",title:"Экватор, тропики и полярные круги",body:`<div class="review-facts"><div class="review-fact"><strong>Экватор</strong>0° широты.</div><div class="review-fact"><strong>Тропики</strong>Около 23,5° северной и южной широты.</div><div class="review-fact"><strong>Полярные круги</strong>Около 66,5° северной и южной широты.</div></div>`},
      {topic:5,kicker:"Внутреннее строение",title:"От поверхности к центру: кора → мантия → ядро",body:`Литосфера — твёрдая оболочка Земли, включающая земную кору и верхнюю часть мантии.<div class="review-formula">земная кора → мантия → ядро</div>`},
      {topic:5,kicker:"Литосферные плиты",title:"Литосфера разделена на крупные движущиеся блоки",body:`Литосферные плиты очень медленно перемещаются. Многие землетрясения, вулканы и процессы горообразования связаны с зонами их взаимодействия.`},
      {topic:5,kicker:"Землетрясение",title:"Очаг и эпицентр — разные понятия",body:`<div class="review-facts"><div class="review-fact"><strong>Очаг</strong>Область в глубине Земли, где возникает землетрясение.</div><div class="review-fact"><strong>Эпицентр</strong>Участок поверхности над очагом.</div></div>`},
      {topic:5,kicker:"Вулканизм",title:"Магма в недрах, лава на поверхности",body:`<div class="review-facts"><div class="review-fact"><strong>Магма</strong>Расплавленное вещество в недрах Земли.</div><div class="review-fact"><strong>Лава</strong>Магма, вышедшая на поверхность.</div></div>`},
      {topic:5,kicker:"Горные породы",title:"По происхождению выделяют три группы",body:`<div class="review-facts"><div class="review-fact"><strong>Магматические</strong>Гранит, базальт.</div><div class="review-fact"><strong>Осадочные</strong>Песчаник, известняк.</div><div class="review-fact"><strong>Метаморфические</strong>Например, мрамор.</div></div>`},
      {topic:5,kicker:"Выветривание и рельеф",title:"Выветривание — не только действие ветра",body:`Горные породы разрушаются и изменяются под действием температуры, воды, организмов и химических процессов.<div class="review-formula">Главные формы рельефа суши: равнины и горы</div><div class="review-tip">Низменности — равнины с абсолютной высотой преимущественно до 200 м.</div>`}
    ],
    questions: [
      ["География","Что изучает география?","Землю, географические объекты, процессы и явления, их размещение и взаимосвязи."],
      ["География","Землетрясение — объект или географическое явление?","Географическое явление (процесс)."],
      ["Открытия","Кто в 1492 году достиг берегов Америки, ища западный путь в Индию?","Христофор Колумб."],
      ["Открытия","Почему путешествие Магеллана называют первым кругосветным, хотя он сам его не завершил?","Его экспедиция первой обошла Землю морским путём; завершил плавание Хуан Себастьян Элькано.",true],
      ["Открытия","С какими русскими мореплавателями связано открытие Антарктиды?","Фаддей Беллинсгаузен и Михаил Лазарев."],
      ["План","Что показывает масштаб?","Во сколько раз расстояние на карте или плане уменьшено по сравнению с местностью."],
      ["План","Какой масштаб крупнее: 1 : 10 000 или 1 : 1 000 000?","1 : 10 000. Чем меньше знаменатель, тем масштаб крупнее.",true],
      ["План","Масштаб 1 : 200 000. На карте 6 см. Каково расстояние на местности?","12 км: 1 см = 2 км, значит 6 см = 12 км.",true],
      ["Высота","Что такое абсолютная высота?","Высота точки относительно уровня моря."],
      ["Высота","Вершина 1850 м, подножие 650 м. Найдите относительную высоту.","1200 м.",true],
      ["Ориентирование","Если вы смотрите на север, где находится восток?","Справа."],
      ["Азимут","Какой азимут соответствует востоку?","90°."],
      ["Азимут","Какой азимут соответствует югу?","180°."],
      ["Азимут","Объект расположен на северо-востоке. Какой азимут примерно?","45°.",true],
      ["Карта","Почему на плоской карте мира неизбежны искажения?","Сферическую поверхность Земли невозможно перенести на плоскость без искажений.",true],
      ["Координаты","Что такое параллель?","Условная линия, проведённая параллельно экватору; направление запад—восток."],
      ["Координаты","Что такое меридиан?","Условная линия, соединяющая Северный и Южный полюса; направление север—юг."],
      ["Координаты","От какой линии отсчитывают широту?","От экватора."],
      ["Координаты","От какой линии отсчитывают долготу?","От нулевого (Гринвичского) меридиана."],
      ["Координаты","Каково максимальное значение широты?","90°."],
      ["Координаты","Каково максимальное значение долготы?","180°."],
      ["Координаты","Что записывают первым: широту или долготу?","Широту."],
      ["Координаты","Точка 30° ю. ш., 60° з. д. В каких полушариях она находится?","В Южном и Западном.",true],
      ["Координаты","Может ли существовать координата 120° северной широты?","Нет. Широта меняется только от 0° до 90°.",true],
      ["Земля","Какое движение Земли вызывает смену дня и ночи?","Вращение вокруг собственной оси."],
      ["Земля","Сколько длится один оборот Земли вокруг оси?","Примерно 24 часа."],
      ["Земля","Почему происходит смена времён года?","Из-за обращения Земли вокруг Солнца и наклона земной оси.",true],
      ["Земля","Ученик говорит: «Зима наступает, потому что Земля дальше от Солнца». Верно?","Нет. Главная причина — наклон оси и обращение вокруг Солнца.",true],
      ["Земля","Что делит Землю на Северное и Южное полушария?","Экватор."],
      ["Литосфера","Назовите внутренние оболочки Земли от поверхности к центру.","Земная кора → мантия → ядро."],
      ["Литосфера","Что такое литосфера?","Твёрдая оболочка Земли, включающая земную кору и верхнюю часть мантии."],
      ["Литосфера","Что такое литосферные плиты?","Крупные блоки литосферы, которые очень медленно перемещаются."],
      ["Литосфера","Почему районы вулканизма и землетрясений часто совпадают?","Они часто приурочены к зонам взаимодействия литосферных плит.",true],
      ["Землетрясение","Чем очаг отличается от эпицентра?","Очаг находится в глубине; эпицентр — участок поверхности над очагом.",true],
      ["Вулканизм","Чем магма отличается от лавы?","Магма находится в недрах; лава — магма, вышедшая на поверхность."],
      ["Выветривание","Вода в трещине замёрзла, расширилась и разрушила камень. Какой процесс?","Физическое выветривание.",true]
    ]
  }
};

let subjectKey = new URLSearchParams(location.search).get("subject") === "geography" ? "geography" : "biology";
let mode = "home";
let items = [];
let index = 0;
let timerValue = 45;
let timerId = null;
let topicFilter = null;

function currentSubject() {
  return subjects[subjectKey];
}

function applySubject() {
  const subject = currentSubject();
  document.body.classList.toggle("is-geography", subjectKey === "geography");
  elements.reviewTitle.textContent = subject.title;
  elements.reviewLead.textContent = subject.lead;
  document.title = subject.title + " — Кабинет учителя";

  document.querySelectorAll("[data-subject]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.subject === subjectKey);
  });

  elements.reviewStats.replaceChildren(...subject.stats.map(([value, label]) => {
    const card = document.createElement("div");
    card.className = "review-stat";
    const strong = document.createElement("strong");
    strong.textContent = value;
    const span = document.createElement("span");
    span.textContent = label;
    card.append(strong, span);
    return card;
  }));

  elements.reviewTopics.replaceChildren(...subject.topics.map(([title, description], topicIndex) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "review-topic-btn";
    button.innerHTML = `<span class="review-topic-index">${String(topicIndex + 1).padStart(2, "0")}</span><strong>${title}</strong><small>${description}</small>`;
    button.addEventListener("click", () => openTheory(topicIndex));
    return button;
  }));

  const url = new URL(location.href);
  url.searchParams.set("subject", subjectKey);
  history.replaceState(null, "", url);
}

function showHome() {
  mode = "home";
  topicFilter = null;
  stopTimer();
  elements.reviewHome.hidden = false;
  elements.reviewStage.hidden = true;
  elements.reviewToolbar.hidden = true;
  elements.reviewProgress.style.width = "0%";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openTheory(topic = null) {
  mode = "theory";
  topicFilter = topic;
  const slides = currentSubject().slides;
  items = topic === null ? [...slides] : slides.filter((slide) => slide.topic === topic);
  index = 0;
  elements.reviewHome.hidden = true;
  elements.reviewStage.hidden = false;
  elements.reviewToolbar.hidden = false;
  elements.reviewReveal.textContent = "К вопросам";
  elements.reviewReveal.disabled = false;
  elements.reviewRandom.hidden = false;
  renderTheory();
}

function openQuiz(hardOnly = false) {
  mode = "quiz";
  topicFilter = null;
  items = currentSubject().questions
    .filter((item) => !hardOnly || item[3])
    .map((item) => ({ category: item[0], question: item[1], answer: item[2], hard: Boolean(item[3]) }));
  shuffle(items);
  index = 0;
  elements.reviewHome.hidden = true;
  elements.reviewStage.hidden = false;
  elements.reviewToolbar.hidden = false;
  elements.reviewReveal.textContent = "Показать ответ";
  elements.reviewReveal.disabled = false;
  elements.reviewRandom.hidden = false;
  renderQuestion();
  restartTimer();
}

function renderTheory() {
  const item = items[index];
  elements.reviewStage.innerHTML = `<article class="review-slide"><div class="review-slide-kicker">${item.kicker}</div><h2>${item.title}</h2><div class="review-slide-body">${item.body}</div></article>`;
  updateProgress();
  stopTimer();
}

function renderQuestion() {
  const item = items[index];
  elements.reviewStage.innerHTML = `<article class="review-question"><div class="review-question-meta"><span>${item.category}${item.hard ? " · сложный" : ""}</span><span>${index + 1} / ${items.length}</span></div><div class="review-question-text">${item.question}</div><div class="review-answer" id="reviewAnswer"><strong>Ответ:</strong> ${item.answer}</div></article>`;
  elements.reviewReveal.textContent = "Показать ответ";
  updateProgress();
}

function reveal() {
  if (mode === "theory") {
    openQuiz(false);
    return;
  }
  if (mode !== "quiz") return;
  const answer = document.getElementById("reviewAnswer");
  if (!answer) return;
  answer.classList.toggle("is-visible");
  elements.reviewReveal.textContent = answer.classList.contains("is-visible") ? "Скрыть ответ" : "Показать ответ";
}

function next() {
  if (index >= items.length - 1) return;
  index += 1;
  if (mode === "theory") renderTheory();
  if (mode === "quiz") {
    renderQuestion();
    restartTimer();
  }
}

function previous() {
  if (index <= 0) return;
  index -= 1;
  if (mode === "theory") renderTheory();
  if (mode === "quiz") {
    renderQuestion();
    restartTimer();
  }
}

function random() {
  if (!items.length) return;
  let nextIndex = index;
  if (items.length > 1) {
    while (nextIndex === index) nextIndex = Math.floor(Math.random() * items.length);
  }
  index = nextIndex;
  if (mode === "theory") renderTheory();
  if (mode === "quiz") {
    renderQuestion();
    restartTimer();
  }
}

function updateProgress() {
  elements.reviewProgress.style.width = items.length ? `${((index + 1) / items.length) * 100}%` : "0%";
}

function restartTimer() {
  if (mode !== "quiz") return;
  stopTimer();
  timerValue = 45;
  updateTimer();
  timerId = window.setInterval(() => {
    timerValue -= 1;
    updateTimer();
    if (timerValue <= 0) {
      stopTimer();
      elements.reviewTimer.textContent = "Время";
    }
  }, 1000);
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function updateTimer() {
  const minutes = String(Math.floor(timerValue / 60)).padStart(2, "0");
  const seconds = String(timerValue % 60).padStart(2, "0");
  elements.reviewTimer.textContent = `${minutes}:${seconds}`;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function setupEvents() {
  document.querySelectorAll("[data-subject]").forEach((button) => {
    button.addEventListener("click", () => {
      subjectKey = button.dataset.subject;
      showHome();
      applySubject();
    });
  });

  elements.startTheory.addEventListener("click", () => openTheory());
  elements.startQuiz.addEventListener("click", () => openQuiz(false));
  elements.startHard.addEventListener("click", () => openQuiz(true));
  elements.reviewPrev.addEventListener("click", previous);
  elements.reviewNext.addEventListener("click", next);
  elements.reviewReveal.addEventListener("click", reveal);
  elements.reviewRandom.addEventListener("click", random);
  elements.reviewTimer.addEventListener("click", restartTimer);

  document.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
    if (event.key === "ArrowRight") next();
    if (event.key === "ArrowLeft") previous();
    if (event.code === "Space") {
      event.preventDefault();
      reveal();
    }
    if (event.key.toLowerCase() === "r") random();
    if (event.key.toLowerCase() === "t") restartTimer();
    if (event.key.toLowerCase() === "f") {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    }
    if (event.key === "Escape" && !document.fullscreenElement && mode !== "home") showHome();
  });

  window.addEventListener("popstate", () => showHome());
}

async function openApp() {
  elements.reviewLoading.hidden = false;
  elements.reviewError.hidden = true;
  elements.reviewApp.hidden = true;

  try {
    const account = await getAccountContext();
    if (!account.signedIn) {
      location.replace("account.html");
      return;
    }
    if (account.profile?.role !== "teacher") {
      location.replace("dashboard.html");
      return;
    }
    setupEvents();
    applySubject();
    updateTimer();
    elements.reviewLoading.hidden = true;
    elements.reviewApp.hidden = false;
  } catch (error) {
    elements.reviewLoading.hidden = true;
    elements.reviewErrorText.textContent = error?.message || "Не удалось проверить аккаунт учителя.";
    elements.reviewError.hidden = false;
  }
}

openApp();
