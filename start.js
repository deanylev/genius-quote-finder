// third party libraries
const Jimp = require('jimp');
const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');

// constants
const IMAGE_SIZE = 500;
const RES_DIR = `${__dirname}/res`;
const TEXT_GAP = 50;
const TEXT_PADDING = 30;

const app = express();

(async () => {
  const fontBlack = await Jimp.loadFont(`${RES_DIR}/Programme-Regular-Black.fnt`);
  const fontWhite = await Jimp.loadFont(`${RES_DIR}/Programme-Regular-White.fnt`);
  const quotesImage = await Jimp.read(`${RES_DIR}/quotes.png`);

  const getLyricsFromUrl = async (url) => {
    for (let i = 0; i < 10; i++) {
      const { data } = await axios.get(url, {
        responseType: 'text'
      });
      const $ = cheerio.load(data);
      const lyrics = $('.lyrics').text().trim();
      if (lyrics) {
        return lyrics.split('\n');
      }
    }

    throw 'gave up';
  };

  const cleanString = (string) => string.replace(/[^0-9A-Za-z-_{}\$\[\]@()\|&\?!;\/\\%#:<>\+\*\^='"`\~\s]/g, '');
  const normaliseString = (string) => string.toLowerCase().replace(/[^0-9a-z-\s]/g, '');

  const splitString = (string, font, width, lengthLimit) => {
    const stringWords = string.split(' ');
    const chunks = [];

    while (stringWords.length > 0) {
      const chunk = [];

      while (Jimp.measureText(font, [...chunk, stringWords[stringWords.length - 1]].join(' ')) < (width - 50) && stringWords.length > 0) {
        chunk.push(stringWords.shift());
      }

      chunks.push(chunk.join(' '));

      if (chunks.length === lengthLimit) {
        chunks.push('...');
        break;
      }
    }

    return chunks;
  };
  const splitLyric = (lyric) => splitString(lyric, fontBlack, IMAGE_SIZE - TEXT_GAP - TEXT_PADDING, 5);
  const splitTitle = (title) => splitString(title.toUpperCase(), fontWhite, IMAGE_SIZE - TEXT_GAP, 3).reverse();

  const renderLyric = (lyric) => {
    const textWidth = Jimp.measureText(fontBlack, lyric);
    const textHeight = Jimp.measureTextHeight(fontBlack, lyric);
    return new Promise((resolve, reject) => {
      new Jimp(textWidth + TEXT_PADDING, textHeight, '#fff', (err, image) => {
        image.print(fontBlack, TEXT_PADDING / 2, 0, lyric);
        resolve(image);
      });
    });
  }

  app.use(express.static('public'));

  app.get('/search', async (req, res) => {
    try {
      const query = req.query.q;
      if (!query) {
        res.sendStatus(400);
        return;
      }

      const index = parseInt(req.query.p, 10) || 0;
      console.log('search', {
        index,
        query
      });
      const { data: { response } } = await axios.get(`https://genius.com/api/search/lyrics?q=${query}`, {
        responseType: 'json'
      });
      const hits = response.sections.find(({ type }) => type === 'lyric')?.hits;
      const match = hits?.[index];
      if (!match) {
        res.sendStatus(404);
        console.warn('no results', {
          index,
          query
        });
        return;
      }
      const { result: { primary_artist, title, url } } = match;
      const normalisedQuery = normaliseString(query);
      const splitNormalisedQuery = normalisedQuery.split(' ');
      const lyrics = (await getLyricsFromUrl(url)).map((lyric) => cleanString(lyric));
      const normalisedLyrics = lyrics.map((lyric) => normaliseString(lyric));
      const matchingNormalisedLyric =
        normalisedLyrics.find((lyric) => lyric.match(new RegExp(`\\b${normalisedQuery}\\b`)))
          || normalisedLyrics.find((lyric) => lyric.includes(normalisedQuery))
          || normalisedLyrics.find((lyric) => splitNormalisedQuery.some((word) => lyric.match(new RegExp(`\\b${word}\\b`))))
          || normalisedLyrics.find((lyric) => splitNormalisedQuery.some((word) => lyric.includes(word)));
      const matchingLyric = lyrics[normalisedLyrics.indexOf(matchingNormalisedLyric)] || query;
      const { data: imageData } = await axios.get(primary_artist.image_url, {
        responseType: 'arraybuffer'
      });
      const lyricArray = splitLyric(matchingLyric);
      const image = (await Jimp.read(imageData)).resize(IMAGE_SIZE, IMAGE_SIZE);
      let blatImage = image.brightness(-0.3);
      for (let i = 0; i < lyricArray.length; i++) {
        const lyricImage = await renderLyric(lyricArray[i]);
        blatImage = blatImage.blit(lyricImage, TEXT_GAP, i * 50 + 20);
      }

      const titleArray = splitTitle(cleanString(`${primary_artist.name} "${title}"`));
      let printedImage = blatImage;
      for (let i = 0; i < titleArray.length; i++) {
        printedImage = printedImage.print(fontWhite, TEXT_GAP, 450 - i * 30, titleArray[i]);
      }

      const buffer = await printedImage.blit(quotesImage, 15, 20).getBufferAsync(Jimp.AUTO);
      res.json({
        data: `data:${image.getMIME()};base64,${buffer.toString('base64')}`,
        hasMore: !!hits[index + 1]
      });
      console.log('generated result', {
        index,
        query
      });
    } catch (error) {
      console.error('error', {
        error
      });
      res.sendStatus(500);
    }
  });

  const port = parseInt(process.env.PORT, 10) || 8080;
  app.listen(port, () => {
    console.log('listening', {
      port
    });
  });
})();