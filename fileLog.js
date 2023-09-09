const fs = require('fs');

const getStat = () => new Promise((resolve, reject) => fs.exists('./stat.json', exists => {
  if ( exists ) fs.readFile('./stat.json', async (err, data) => {
    const stat = JSON.parse(data);
    const lastStat = Object.entries(stat)[Object.entries(stat).length-1];
    if ( !lastStat || !lastStat[0] || Date.now() - +lastStat[0] > parseHourPeriod*3600*1000) return resolve( {...await parseRates(), date: Date.now() }); // *3600*1000
    else return resolve( {...lastStat[1], date: lastStat[0]} );
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

// app.get('/', async (req, res) => {
//   let result = await getStat();
//   res.render('index', showResults({...result, rublesIsThere, }) );
// })

// app.post('/', async function(req, res) {
//   let result = await getStat();
//   res.render('index', showResults({...result, 
//     rublesIsThere: +req.body.rubIsshetre,
//     borderRun: +req.body.borderRunPrice,
//     condoRent: +req.body.condoMonthRent,
//     staying: +req.body.stayingMonth,
//   }) );
// });