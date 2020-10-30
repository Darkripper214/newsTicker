const express = require('express');
const hbs = require('express-handlebars');
const fetch = require('node-fetch');
const withQuery = require('with-query').default;
const cache = require('memory-cache');

const port = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3838;

let memCache = new cache.Cache();

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
      res.send(cacheContent);
      return;
    } else {
      res.sendResponse = res.send;
      res.send = (body) => {
        memCache.put(key, body, duration * 1000);
        res.sendResponse(body);
      };
      console.log('DID NOT SENT CACHE!!!!');
      next();
    }
  };
};

const app = express();
app.engine('hbs', hbs({ defaultLayout: 'default.hbs' }));
app.set('view engine', 'hbs');
app.set('views', __dirname + '/views');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('static'));

app.get('/search', cacheMiddleware(60), async (req, res) => {
  const response = await fetch(
    withQuery(END_POINT, {
      q: req.query.search,
      apiKey: API_KEY,
      pageSize: pageSize,
      country: req.query.country,
      category: req.query.category,
    })
  );
  console.log(`Query made on ${new Date()}`);

  const jsonRes = await response.json();
  let articles = jsonRes.articles;
  // Replace null image with not availableimage
  articles = articles.map((article) => {
    article.urlToImage =
      article.urlToImage ||
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/600px-No_image_available.svg.png';

    article.publishedAt = new Date(
      Date.parse(article.publishedAt)
    ).toLocaleString();

    // Storing hidden search time
    article['searchTime'] = new Date();
    return article;
  });
  res.render('result', { articles });
});

app.get('/', (req, res) => {
  res.render('landing');
});

app.listen(port, () =>
  console.log(
    `Running on http://localhost:${port} on ${new Date()} \n with API_KEY=${
      process.env.API_KEY
    }`
  )
);
