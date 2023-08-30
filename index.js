const fs = require('fs');
const request = require('request');
const cheerio = require('cheerio');
const express = require('express');
const consolidate = require('consolidate')

const app = express();
app.engine('hbs', consolidate.handlebars);
app.set('view engine', 'hbs');
app.set('views', `${__dirname}/views`);

const moneyFormat = (num, curr=null) => {
  symbols = {'rub': '₽', 'cny': '¥ ', 'usd': '$  ', 'thb': '฿'};
  return `${curr ? symbols[curr] : ''} ${Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`
};

const {bathIsThere, thaiMonth, rublesIsThere, condoMonthRent, borderRunPrice, stayingMonth, parseHourPeriod} = require('./config.json');

const getStat = (thai_month, rubles) => new Promise((resolve, reject) => fs.exists('./stat.json', exists => {
  if ( exists ) fs.readFile('./stat.json', async (err, data) => {
    const stat = JSON.parse(data);
    const lastStat = Object.entries(stat)[Object.entries(stat).length-1];
    if ( !lastStat || !lastStat[0] || Date.now() - +lastStat[0] > parseHourPeriod*3600*1000) return resolve(await parseRates( thai_month, rubles, Date.now() )); // *3600*1000
    else {
      return resolve( {...lastStat[1], thai_month, rubles, lastStat: lastStat[0]} );
    }
  })
}));

const parseRates = async ( thai_month, rubles, lastStat ) => new Promise((resolve, reject) => {
  return request('https://pattaya-city.ru/banki/kurs', (err, response, html) => {
    if ( !err && response.statusCode === 200 ) {
      const { bath_usd, bath_cny, bath_rub } = pattayaCityRu(html);
      return request('https://www.atb.su/services/exchange/', (err, response, html) => {
        if ( !err && response.statusCode === 200 ) {
          const { cny_rub, usd_rub } = atbSu(html);
          saveStat( { [Date.now()]: { bath_usd, bath_cny, bath_rub, cny_rub, usd_rub, }, } );
          return resolve({bath_usd, bath_cny, bath_rub, cny_rub, usd_rub, thai_month, rubles, lastStat});
        }  
      });
    }
  })
})

const saveStat = addStat => fs.exists('./stat.json', exists => {
  if ( exists ) fs.readFile('./stat.json', (err, data) => {  
    const stat = JSON.parse(data);
    const saveStat = {...stat, ...addStat};
    fs.writeFile('./stat.json', JSON.stringify(saveStat), (err) => {
     if ( err ) console.error(err);
    })
  })
})

const pattayaCityRu = html => {
  const $ = cheerio.load(html);
  const bath_usd = parseFloat($('#toc-2').parent('h2').next('p').next('div').find('.widget')
    .find('.currencyconverter-minimalistic-container')
    .find('.currencyconverter-minimalistic-single-currency')
    .find('.currencyconverter-minimalistic-row')
    .find('.currencyconverter-minimalistic-currency-price').text().replace(',', '.'));
  const bath_cny = parseFloat($('.widget_currencyconverter_table').eq(0).find('table')
    .find('tbody').find('tr').eq(5).find('td').eq(1).find('span').text().replace(',', '.'));
  const bath_rub = parseFloat($('#toc').parent('h2').next('p').next('div').find('.widget')
    .find('.currencyconverter-minimalistic-container')
    .find('.currencyconverter-minimalistic-single-currency')
    .find('.currencyconverter-minimalistic-row')
    .find('.currencyconverter-minimalistic-currency-price').text().replace(',', '.'));
  return {bath_usd, bath_cny, bath_rub}
}

const atbSu = html => {
  const $ = cheerio.load(html);          
  cny_rub = parseFloat($('#currencyTab1').find('.currency-table').find('.currency-table__tr').eq(1).find('.currency-table__td').eq(2).text());
  usd_rub = parseFloat($('#currencyTab1').find('.currency-table').find('.currency-table__tr').eq(2).find('.currency-table__td').eq(2).text());
  return {cny_rub, usd_rub}
}




app.get('/', async (req, res) => {
  let result = await getStat( 20000, 300000 );
  
  // console.log(result);
  // showResults(result);
  // console.log( showResults(result) );

  res.render('index', {
    title: 'Hello, world',
    features: showResults(result),
  });
})


// app.post('/', (req, res) => {
//   console.log(req.body);
//   const thaiMonth = 20000;
//   const rublesIsThere = 300000;
//   console.log( getStat( thaiMonth, rublesIsThere ) );

//   res.send('Ok');
// })

app.listen(8888);











// if ( lastStat && lastStat[0] ) console.log(`\n Latest rate update: ${cc.set('fg_blue', new Date(+lastStat[0]))}`);


const showResults = dataRates => {
  const {bath_usd, bath_cny, bath_rub, cny_rub, usd_rub, thai_month, rubles, lastStat  } = dataRates;
  const yuan = rubles / cny_rub;
  const dollars = rubles / usd_rub;
  const rubToBath = bath_rub * rubles;
  const cnyToBath = bath_cny * yuan;
  const usdToBath = bath_usd * dollars;
  const baths = val => moneyFormat(val, 'thb');
  const stay = val => Math.floor((val + bathIsThere) / thai_month) + ' month';
  const weekExpss = (val) =>  Math.floor((val + bathIsThere - condoMonthRent * stayingMonth - borderRunPrice * (stayingMonth / 1.5)) / (181 / 7) )
  return [
    {name: 'Latest rate update', value: new Date(+lastStat)},
    {name: 'rub', value: `${moneyFormat(rubles, 'rub')} - ${baths(rubToBath)} (${stay(rubToBath)})`},
    {name: 'cny', value: `${moneyFormat(yuan, 'cny')} - ${baths(cnyToBath)} (${stay(cnyToBath)})`},
    {name: 'usd', value: `${moneyFormat(dollars, 'usd')} - ${baths(usdToBath)} (${stay(usdToBath)})`},
    {name: 'week', value: `${ moneyFormat(Math.round((weekExpss(rubToBath) + weekExpss(cnyToBath) + weekExpss(usdToBath)) / 3), 'thb') } a week`},
  ]
}


// console.log(`\n Bath is there: ${moneyFormat(bathIsThere)}`);
// console.log(` Condo month rent: ${moneyFormat(condoMonthRent)}`);
// console.log(` Border run price: ${moneyFormat(borderRunPrice)}`);
// console.log(` Staying month: ${stayingMonth}`);