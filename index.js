const express = require('express');
const hbs = require('express-handlebars');
const fetch = require('node-fetch');
const withQuery = require('with-query').default;
const cache = require('memory-cache');

const port = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3838;

let memCache = new cache.Cache();
let cacheTime = new Date();
// news api related variables
const API_KEY = process.env.API_KEY;
const pageSize = 9;
const END_POINT = 'https://newsapi.org/v2/top-headlines';

let cacheMiddleware = (duration) => {
  return (req, res, next) => {
    let key = '__express__' + req.originalUrl || req.url;
    let cacheContent = memCache.get(key);
    if (cacheContent) {
      console.log('SENT CACHE!!!!');
      res.status('304');
      res.append('Last-Modified', cacheTime.toUTCString());
      res.send(cacheContent);
      return;
    } else {
      res.sendResponse = res.send;
      res.send = (body) => {
        console.log('DID NOT SENT CACHE!!!!');
        memCache.put(key, body, duration * 1000);
        res.sendResponse(body);
      };
    }
    next();
  };
};

const app = express();
app.engine('hbs', hbs({ defaultLayout: 'default.hbs' }));
app.set('view engine', 'hbs');
app.set('views', __dirname + '/views');
app.set('etag', false);
app.use(express.urlencoded({ extended: true }));
app.use(express.static('static'));

app.get('/search', cacheMiddleware(60), async (req, res) => {
  let endpoint = withQuery(END_POINT, {
    q: req.query.search,
    /* apiKey: API_KEY, */
    pageSize: pageSize,
    country: req.query.country,
    category: req.query.category,
  });

  const response = await fetch(endpoint, {
    headers: { 'X-Api-Key': API_KEY },
  });

  let searchTime = new Date();
  console.log(`Query made on ${searchTime}`);

  const jsonRes = await response.json();
  let articles = jsonRes.articles;

  if (cacheTime - searchTime < -30000) {
    console.log(cacheTime - searchTime);
    cacheTime = searchTime;
  }

  console.log(cacheTime);
  // Replace null image with not availableimage
  articles = articles.map((article) => {
    article.urlToImage =
      article.urlToImage ||
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/600px-No_image_available.svg.png';

    article.publishedAt = new Date(
      Date.parse(article.publishedAt)
    ).toLocaleString();

    // Storing hidden search time
    article['searchTime'] = searchTime;
    return article;
  });
  res.append('Last-Modified', cacheTime.toUTCString());
  res.render('result', { articles });
});

app.get('/', (req, res) => {
  console.log(res.render);
  res.render('landing');
});

app.listen(port, () =>
  console.log(
    `Running on http://localhost:${port} on ${new Date()} \n with API_KEY=${API_KEY}`
  )
);
