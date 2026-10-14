export const planDefaults = [
  {code:'free',name:'Бесплатный',monthlyPrice:0,annualPrice:0,limits:{calculations:10,deals:3,pdf:3,products:0,xlsx:false,logo:false,templates:['standard']}},
  {code:'pro',name:'Pro',monthlyPrice:490,annualPrice:5880,limits:{calculations:500,deals:100,pdf:100,products:500,xlsx:true,logo:true,templates:['standard','compact','presentation']}},
  {code:'business',name:'Business',monthlyPrice:990,annualPrice:11880,limits:{calculations:5000,deals:1000,pdf:500,products:5000,xlsx:true,logo:true,templates:['standard','compact','presentation']}}
];
export type Limits = typeof planDefaults[number]['limits'];
export const articles = [
 {slug:'margin-vs-markup',title:'Маржа и наценка: в чём разница',body:'Закупка 800 ₽, продажа 1 000 ₽. Торговая прибыль 200 ₽. Маржа: 200 / 1 000 × 100 = 20%. Наценка: 200 / 800 × 100 = 25%. У показателей разные знаменатели. Они не включают все налоги и расходы компании.'},
 {slug:'how-to-calculate-selling-price',title:'Как рассчитать цену продажи',body:'При желаемой марже 20% и закупке 800 ₽ цена равна 800 / (1 − 0,2) = 1 000 ₽. При наценке 20% цена равна 800 × 1,2 = 960 ₽. Учитывайте дополнительные расходы и применимый режим НДС.'},
 {slug:'vat-calculation',title:'Начисление и выделение НДС',body:'При начислении налога сверху: сумма × ставка / 100. При выделении: сумма × ставка / (100 + ставка). Для условной ставки 20% из 1 200 ₽ выделяется 200 ₽. Ставку и применимость режима определяет пользователь.'},
 {slug:'commercial-proposal-guide',title:'Как подготовить коммерческое предложение',body:'Укажите продавца и клиента, товары, количество, цены, условия оплаты, поставки и гарантии. Проверьте срок действия. Опубликуйте отдельную версию. Закупочные цены и внутренняя прибыль не входят в клиентский документ. Просмотр ссылки не означает согласия клиента.'}
];
