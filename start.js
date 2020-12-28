// third party libraries
const Jimp = require('jimp');
const NodeCache = require('node-cache');
const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const removeAccents = require('remove-accents');

// constants
const CACHE_EXPIRY = 60 * 10; // 10 minutes
const CACHE_NAMESPACE_API = 'API_';
const CACHE_NAMESPACE_ARTIST_IMAGE = 'ARTISTIMAGE_';
const CACHE_NAMESPACE_SCRAPED = 'SCRAPED_';
const HEIGHT_LIMIT_INFO = 3;
const HEIGHT_LIMIT_LYRICS = 5;
const IMAGE_SIZE = 500;
const LYRIC_PADDING = 20;
const RES_DIR = `${__dirname}/res`;
const SONG_INFO_OFFSET = 50;
const SCRAPING_ATTEMPTS = 10;
const TEXT_GAP = 50;

const app = express();
const cache = new NodeCache({
  useClones: false
});
let requestIdGenerator = 0;

(async () => {
  const fontBlack = await Jimp.loadFont(`${RES_DIR}/Programme-Regular-Black.fnt`);
  const fontWhite = await Jimp.loadFont(`${RES_DIR}/Programme-Regular-White.fnt`);
  const quotesImage = await Jimp.read(`${RES_DIR}/quotes.png`);

  const scapeDataFromUrl = async (url) => {
    // lyrics can sometimes come back blank so try a few times
    for (let i = 0; i < SCRAPING_ATTEMPTS; i++) {
      const { data } = await axios.get(url, {
        responseType: 'text'
      });
      const $ = cheerio.load(data);
      const lyrics = $('.lyrics').text().trim();
      const videoLink = JSON.parse($('meta[itemprop="page_data"]').attr('content') || '{}').song?.youtube_url;
      if (lyrics) {
        return {
          lyrics: lyrics.split('\n'),
          videoLink
        };
      }
    }

    throw 'gave up';
  };

  // only allow characters our fnt file supports
  const cleanString = (string) => removeAccents(string)
    .replace(/’/g, '\'')
    .replace(/—/g, '-')
    .replace(/[^0-9A-Za-z-_,.{}$[\]@()|&?!;/\\%#:<>+*^='"`~\s]/g, '');
  // strip out non-alphanumeric characters
  const normaliseString = (string) => string.toLowerCase().replace(/[^0-9a-z-\s]/g, '');

  // split string into chunks we can render onto the image
  const splitString = (string, font, width, lengthLimit) => {
    const stringWords = string.split(' ');
    const chunks = [];
    let hasMoreSpace = true;

    while (stringWords.length > 0) {
      const chunk = [];

      while (Jimp.measureText(font, [...chunk, stringWords[0]].join(' ')) < width && stringWords.length > 0) {
        const word = stringWords.shift();
        chunk.push(word);

        if (word.endsWith('\n')) {
          break;
        }
      }

      chunks.push(chunk.join(' '));

      if (chunks.length === lengthLimit) {
        hasMoreSpace = false;

        if (stringWords.length > 0) {
          chunks.push('...');
        }
        break;
      }
    }

    return {
      chunks,
      hasMoreSpace
    };
  };
  const splitLyric = (lyric, lengthLimit) => splitString(lyric, fontBlack, IMAGE_SIZE - TEXT_GAP - LYRIC_PADDING, lengthLimit);
  // reverse so we can render from the bottom up, discard hasMoreSpace property as it's not used
  const splitTitle = (title) => splitString(title.toUpperCase(), fontWhite, IMAGE_SIZE - TEXT_GAP, 3).chunks.reverse();

  const renderLyric = (lyric) => {
    const textWidth = Jimp.measureText(fontBlack, lyric);
    const textHeight = Jimp.measureTextHeight(fontBlack, lyric);
    return new Promise((resolve, reject) => {
      new Jimp(textWidth + LYRIC_PADDING, textHeight, '#fff', (error, image) => {
        if (error) {
          reject(error);
          return;
        }

        image.print(fontBlack, LYRIC_PADDING / 2, 0, lyric);
        resolve(image);
      });
    });
  };

  app.use(express.static('public'));

  app.get('/search', async (req, res) => {
    const requestId = `${process.pid}-${++requestIdGenerator}`;
    try {
      const query = req.query.q?.trim().toLowerCase();
      if (!query) {
        console.warn('malformed query', {
          reqQuery: req.query,
          requestId
        });
        res.sendStatus(400);
        return;
      }

      const index = parseInt(req.query.p, 10) || 0;
      const startOffset = parseInt(req.query.so, 10) || 0;
      const endOffset = parseInt(req.query.eo, 10) || 0;
      console.log('search', {
        index,
        query,
        requestId
      });
      // fetch API data
      const cachedResponseKey = `${CACHE_NAMESPACE_API}${query}`;
      let response = cache.get(cachedResponseKey);
      if (response) {
        console.log('using cached response', {
          requestId
        });
      } else {
        console.log('no cached response, fetching...', {
          requestId
        });
        ({ data: { response } } = await axios.get(`https://genius.com/api/search/lyrics?q=${query}`, {
          responseType: 'json'
        }));
        cache.set(cachedResponseKey, response, CACHE_EXPIRY);
      }
      const hits = response.sections.find(({ type }) => type === 'lyric')?.hits;
      const match = hits?.[index];
      if (!match) {
        res.sendStatus(404);
        console.warn('no results', {
          requestId
        });
        return;
      }
      const { result: { primary_artist, title, url } } = match;
      // strip out non-alphanumeric characters from the query for fuzzier matching
      const normalisedQuery = normaliseString(query);
      const splitNormalisedQuery = normalisedQuery.split(' ');
      // scrape lyrics and YouTube URL
      const cachedScrapedDataKey = `${CACHE_NAMESPACE_SCRAPED}${url}`;
      let scrapedData = cache.get(cachedScrapedDataKey);
      if (scrapedData) {
        console.log('using cached scraped data', {
          requestId
        });
      } else {
        console.log('no cached scraped data, fetching...', {
          requestId
        });
        scrapedData = await scapeDataFromUrl(url);
        cache.set(cachedScrapedDataKey, scrapedData, CACHE_EXPIRY);
      }
      // filter out characters that we can't print using our fnt file
      const lyrics = scrapedData.lyrics.map((lyric) => cleanString(lyric)).filter((lyric) => lyric);
      // again strip out non-alphanumeric characters to match our query
      const normalisedLyrics = lyrics.map((lyric) => normaliseString(lyric));
      // try find the closest match
      const matchingNormalisedLyric =
        // exact match for our query
        normalisedLyrics.find((lyric) => lyric.match(new RegExp(`\\b${normalisedQuery}\\b`)))
          // match without boundaries
          || normalisedLyrics.find((lyric) => lyric.includes(normalisedQuery))
          // exact match of one of the words in our query
          || normalisedLyrics.find((lyric) => splitNormalisedQuery.some((word) => lyric.match(new RegExp(`\\b${word}\\b`))))
          // match of one of the words in our query without boundaries
          || normalisedLyrics.find((lyric) => splitNormalisedQuery.some((word) => lyric.includes(word)));
      const matchingIndex = normalisedLyrics.indexOf(matchingNormalisedLyric);
      // apply user offsets
      const startIndex = matchingIndex - startOffset;
      const endIndex = matchingIndex + 1 + endOffset;
      const matchingLyric = matchingIndex === -1 ? query : lyrics.slice(startIndex, endIndex).join('\n ');
      // fetch artist image
      const cachedImageDataKey = `${CACHE_NAMESPACE_ARTIST_IMAGE}${primary_artist.image_url}`
      let imageData = cache.get(cachedImageDataKey);
      if (imageData) {
        console.log('using cached image data', {
          requestId
        });
      } else {
        console.log('no cached image data, fetching...', {
          requestId
        });
        ({ data: imageData } = await axios.get(primary_artist.image_url, {
          responseType: 'arraybuffer'
        }));
        cache.set(cachedImageDataKey, imageData, CACHE_EXPIRY);
      }
      // apply splitting algorithm to fit the text over our image
      const titleArray = splitTitle(cleanString(`${primary_artist.name} "${title}"`));
      const { chunks: lyricArray, hasMoreSpace } = splitLyric(matchingLyric, HEIGHT_LIMIT_LYRICS + HEIGHT_LIMIT_INFO - titleArray.length);
      // resize/darken image, then render lyric chunks one by one
      const image = (await Jimp.read(imageData)).resize(IMAGE_SIZE, IMAGE_SIZE);
      let blatImage = image.brightness(-0.3);
      for (let i = 0; i < lyricArray.length; i++) {
        const lyricImage = await renderLyric(lyricArray[i]);
        blatImage = blatImage.blit(lyricImage, TEXT_GAP, i * 50 + 20);
      }

      // render song info
      // this could pretty easily be a reduce loop but seems nicer to match blocking loop above
      let printedImage = blatImage;
      for (let i = 0; i < titleArray.length; i++) {
        printedImage = printedImage.print(fontWhite, TEXT_GAP, IMAGE_SIZE - SONG_INFO_OFFSET - i * 30, titleArray[i]);
      }

      // render quote icon and extract final buffer
      const buffer = await printedImage.blit(quotesImage, 15, 20).getBufferAsync(Jimp.AUTO);
      if (req.query.d === 'true') {
        // debug, just send image
        res.setHeader('Content-Type', image.getMIME());
        res.send(buffer);
      } else {
        // send general metadata and base64 encoded image
        res.json({
          hasMoreEndOffset: matchingIndex !== -1 && hasMoreSpace && endIndex < lyrics.length,
          hasMorePages: !!hits[index + 1],
          hasMoreStartOffset: matchingIndex !== -1 && hasMoreSpace && startIndex > 0,
          imageData: `data:${image.getMIME()};base64,${buffer.toString('base64')}`,
          lyricsLink: url,
          videoLink: scrapedData.videoLink
        });
      }
      console.log('generated result', {
        requestId
      });
    } catch (error) {
      console.error('error', {
        error,
        requestId
      });
      res.sendStatus(500);
    }
  });

  const server = app.listen(parseInt(process.env.PORT, 10) || 8080, () => {
    console.log('listening', {
      port: server.address().port
    });
  });
})();
