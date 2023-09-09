const request = require('request');
const cheerio = require('cheerio');
const express = require('express');
const consolidate = require('consolidate')
const bodyParser = require('body-parser');

const { bathIsThere, rublesIsThere, condoMonthRent, borderRunPrice, stayingMonth, parseHourPeriod } = require('./config.json');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.engine('hbs', consolidate.handlebars);
app.set('view engine', 'hbs');
app.set('views', `${__dirname}/views`);

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const RatesSchema = new Schema({
  date: { type: String, required: true, },
  bath_usd: { type: Number, required: true, },
  bath_cny: { type: Number, required: true, },
  bath_rub: { type: Number, required: true, },
  cny_rub: { type: Number, required: true, },
  usd_rub: { type: Number, required: true, },
});
const Rate =  mongoose.model('rate', RatesSchema);

const getMongo = async() => {
  await mongoose.connect('mongodb://127.0.0.1:27017/rubToBaht');
  const rate = await Rate.find({});
  const lastLog = rate.reduce((last, log) => !Object.keys(last).length || last.date < log.date ? last = log : last = last , {});
  if ( !lastLog || !lastLog.date || Date.now() - +lastLog.date > parseHourPeriod*1000*3600) return {...await parseRates(), date: Date.now() }; // *3600*1000
  else return lastLog._doc;

}

const setMongoDate = dataLog => mongoose.connect('mongodb://127.0.0.1:27017/rubToBaht').then(() => {
  const { date, bath_usd, bath_cny, bath_rub, cny_rub, usd_rub, } = dataLog;
  const rate = new Rate({ date, bath_usd, bath_cny, bath_rub, cny_rub, usd_rub, });
  rate.save().then(
    rate => console.log('Document', rate),
    err => console.error(err)
  );
});

const parseRates = () => new Promise((resolve, reject) => {
  return request('https://pattaya-city.ru/banki/kurs', (err, response, html) => {
    if ( !err && response.statusCode === 200 ) {
      const { bath_usd, bath_cny, bath_rub } = pattayaCityRu(html);
      return request('https://www.atb.su/services/exchange/', (err, response, html) => {
        if ( !err && response.statusCode === 200 ) {
          const { cny_rub, usd_rub } = atbSu(html);
          setMongoDate( { date: Date.now(), bath_usd, bath_cny, bath_rub, cny_rub, usd_rub, } );
          return resolve({bath_usd, bath_cny, bath_rub, cny_rub, usd_rub});
        }  
      });
    }
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

const moneyFormat = (num, curr=null) => {
  symbols = {'rub': '₽', 'cny': '¥ ', 'usd': '$  ', 'thb': '฿'};
  return `${curr ? symbols[curr] : ''} ${Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`
};

const showResults = dataRates => {
  const {bath_usd, bath_cny, bath_rub, cny_rub, usd_rub, date, rublesIsThere, } = dataRates;
  const borderRun = dataRates.borderRun ? dataRates.borderRun : borderRunPrice;
  const condoRent = dataRates.condoRent ? dataRates.condoRent : condoMonthRent;
  const staying = dataRates.staying ? dataRates.staying : stayingMonth;
  const yuan = rublesIsThere / cny_rub;
  const dollars = rublesIsThere / usd_rub;
  const rubToBath = bath_rub * rublesIsThere;
  const cnyToBath = bath_cny * yuan;
  const usdToBath = bath_usd * dollars;
  const baths = val => moneyFormat(val, 'thb');
  const weekExpss = (val) => Math.floor((val + bathIsThere - condoRent * staying - borderRun * (staying / 1.5)) / (181 / 7) )
  return {
    lastStat: new Date(+date),
    rublesIsThere: rublesIsThere,
    bathIsThere: bathIsThere,
    condoMonthRent: condoRent,
    borderRunPrice: borderRun,
    stayingMonth: +staying,
    rubRes: `${moneyFormat(rublesIsThere, 'rub')} - ${baths(rubToBath)} (${moneyFormat(weekExpss(rubToBath), 'thb')} a week)`,
    cnyRes: `${moneyFormat(yuan, 'cny')} - ${baths(cnyToBath)} (${moneyFormat(weekExpss(cnyToBath), 'thb')} a week)`,
    usdRes: `${moneyFormat(dollars, 'usd')} - ${baths(usdToBath)} (${moneyFormat(weekExpss(usdToBath), 'thb')} a week)`,
    weekExpss: `${ moneyFormat(Math.round((weekExpss(rubToBath) + weekExpss(cnyToBath) + weekExpss(usdToBath)) / 3), 'thb') }`,
  }
}

app.get('/', async (req, res) => {
  const result = await getMongo();
  res.render('index', showResults({...result, rublesIsThere, }) );
})

app.post('/', async function(req, res) {
  const result = await getMongo();
  res.render('index', showResults({...result, 
    rublesIsThere: +req.body.rubIsshetre,
    borderRun: +req.body.borderRunPrice,
    condoRent: +req.body.condoMonthRent,
    staying: +req.body.stayingMonth,
    lastStat: result.date,
  }));
});

app.listen(8888);
