const fs = require('fs');
const request = require('request');
const cheerio = require('cheerio');
const express = require('express');
const consolidate = require('consolidate')
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const Schema = mongoose.Schema;
mongoose.connect('mongodb://127.0.0.1:27017/rubToBaht')
  .then(() => {
    console.log('Connected to rubToBaht!!!');
    const RatesSchema = new Schema({
      date: {
        type: String,
        required: true,
      },
      bath_usd: {
        type: Number,
        required: true,
      },
      bath_cny: {
        type: Number,
        required: true,
      },
      bath_rub: {
        type: Number,
        required: true,
      },
      cny_rub: {
        type: Number,
        required: true,
      },
      usd_rub: {
        type: Number,
        required: true,
      },
    });
    const Rate = mongoose.model('rate', RatesSchema);
    /* Insert
    [
      {
        date: '1693543330006',
        bath_usd: 35.06,
        bath_cny: 4.83,
        bath_rub: 0.37,
        cny_rub: 13.6,
        usd_rub: 96.7
      },
      {
        date: '1693543351805',
        bath_usd: 35.06,
        bath_cny: 4.83,
        bath_rub: 0.37,
        cny_rub: 13.6,
        usd_rub: 96.7
      },
      {
        date: '1693543572085',
        bath_usd: 35.06,
        bath_cny: 4.83,
        bath_rub: 0.37,
        cny_rub: 13.6,
        usd_rub: 96.7
      },
      {
        date: '1693563610827',
        bath_usd: 35.01,
        bath_cny: 4.82,
        bath_rub: 0.36,
        cny_rub: 13.84,
        usd_rub: 96.99
      },
      {
        date: '1693563623278',
        bath_usd: 35.01,
        bath_cny: 4.82,
        bath_rub: 0.36,
        cny_rub: 13.84,
        usd_rub: 96.99
      },      
    ].map(item => {
      const { date, bath_usd, bath_cny, bath_rub, cny_rub, usd_rub, } = item;
      const rate = new Rate({
        date,
        bath_usd,
        bath_cny,
        bath_rub,
        cny_rub,
        usd_rub,
      });
      rate.save().then(rate => {
        console.log('Document', rate);
      }, err => {
        console.error(err);
      });
    })
    //*/

   //* Select

      Rate.find({}).then(rate => {
      // Person.findOne().then(user => {
      // Person.findOne({userName: /t/ig }).then(user => {
        console.log('Document', rate);
      }, err => {
        console.error(err);
      })
    //*/

  });




const app = express();
// const multer = require('multer');
// const forms = multer();
// app.use(forms.array()); 

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.engine('hbs', consolidate.handlebars);
app.set('view engine', 'hbs');
app.set('views', `${__dirname}/views`);

const {bathIsThere, thaiMonth, rublesIsThere, condoMonthRent, borderRunPrice, stayingMonth, parseHourPeriod} = require('./config.json');

const getStat = () => new Promise((resolve, reject) => fs.exists('./stat.json', exists => {
  if ( exists ) fs.readFile('./stat.json', async (err, data) => {
    const stat = JSON.parse(data);
    console.log(stat);
    const lastStat = Object.entries(stat)[Object.entries(stat).length-1];
    if ( !lastStat || !lastStat[0] || Date.now() - +lastStat[0] > parseHourPeriod*3600*1000) return resolve( {...await parseRates(), lastStat: Date.now() }); // *3600*1000
    else {
      return resolve( {...lastStat[1], lastStat: lastStat[0]} );
    }
  })
}));

const saveStat = addStat => fs.exists('./stat.json', exists => {
  if ( exists ) fs.readFile('./stat.json', (err, data) => {  
    const stat = JSON.parse(data);
    const saveStat = {...stat, ...addStat};
    fs.writeFile('./stat.json', JSON.stringify(saveStat), (err) => {
     if ( err ) console.error(err);
    })
  })
})

const parseRates = () => new Promise((resolve, reject) => {
  return request('https://pattaya-city.ru/banki/kurs', (err, response, html) => {
    if ( !err && response.statusCode === 200 ) {
      const { bath_usd, bath_cny, bath_rub } = pattayaCityRu(html);
      return request('https://www.atb.su/services/exchange/', (err, response, html) => {
        if ( !err && response.statusCode === 200 ) {
          const { cny_rub, usd_rub } = atbSu(html);
          saveStat( { [Date.now()]: { bath_usd, bath_cny, bath_rub, cny_rub, usd_rub, }, } );
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
  // console.log(dataRates);
  const {bath_usd, bath_cny, bath_rub, cny_rub, usd_rub, lastStat, thaiMonth, rublesIsThere, } = dataRates;

  const borderRun = dataRates.borderRun ? dataRates.borderRun : borderRunPrice;
  const condoRent = dataRates.condoRent ? dataRates.condoRent : condoMonthRent;
  const staying = dataRates.staying ? dataRates.staying : stayingMonth;

  const yuan = rublesIsThere / cny_rub;
  const dollars = rublesIsThere / usd_rub;
  const rubToBath = bath_rub * rublesIsThere;
  const cnyToBath = bath_cny * yuan;
  const usdToBath = bath_usd * dollars;
  const baths = val => moneyFormat(val, 'thb');
  const stay = val => Math.floor((val + bathIsThere) / thaiMonth) + ' month';
  const weekExpss = (val) => Math.floor((val + bathIsThere - condoRent * staying - borderRun * (staying / 1.5)) / (181 / 7) )
  return {
    lastStat: new Date(+lastStat),
    thaiMonth: thaiMonth,
    rublesIsThere: rublesIsThere,
    bathIsThere: bathIsThere,
    condoMonthRent: condoRent,
    borderRunPrice: borderRun,
    stayingMonth: +staying,
    rubRes: `${moneyFormat(rublesIsThere, 'rub')} - ${baths(rubToBath)} (${stay(rubToBath)})`,
    cnyRes: `${moneyFormat(yuan, 'cny')} - ${baths(cnyToBath)} (${stay(cnyToBath)})`,
    usdRes: `${moneyFormat(dollars, 'usd')} - ${baths(usdToBath)} (${stay(usdToBath)})`,
    weekExpss: `${ moneyFormat(Math.round((weekExpss(rubToBath) + weekExpss(cnyToBath) + weekExpss(usdToBath)) / 3), 'thb') }`,
  }
}

app.get('/', async (req, res) => {
  let result = await getStat();
  // console.log(result);
  res.render('index', showResults({...result, thaiMonth, rublesIsThere, }) );
})

app.post('/', async function(req, res) {
  // console.log(req.body);
  let result = await getStat();
  res.render('index', showResults({...result, 
    thaiMonth: +req.body.bathPerWeek, 
    rublesIsThere: +req.body.rubIsshetre,
    borderRun: +req.body.borderRunPrice,
    condoRent: +req.body.condoMonthRent,
    staying: +req.body.stayingMonth,
  }) );
});

app.listen(8888);
