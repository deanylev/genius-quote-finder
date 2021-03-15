/**
 * muh render pipeline™
 */

// constants
const clickDelay = 500;
const offsetInFlightText = 'Regenerating...';
const themeMessages = ['lol jk', 'why tho', 'stop it', 'i am warning you', 'fine'];

// vars
let activeLyricsLink: null | string = null;
let activeVideoLink: null | string = null;
let clickTimeout: null | number = null;
let endOffset = 0;
let page = 0;
let query = '';
let startOffset = 0;
let themeClicked = false;

// elements
const body = document.querySelector('body') as HTMLBodyElement;
const endOffsetDown = document.getElementById('end-offset-down') as HTMLButtonElement;
const endOffsetUp = document.getElementById('end-offset-up') as HTMLButtonElement;
const form = document.getElementById('form') as HTMLFormElement;
const image = document.querySelector('img') as HTMLImageElement;
const input = document.querySelector('input') as HTMLInputElement;
const message = document.getElementById('message') as HTMLDivElement;
const next = document.getElementById('next') as HTMLButtonElement;
const previous = document.getElementById('previous') as HTMLButtonElement;
const startOffsetDown = document.getElementById('start-offset-down') as HTMLButtonElement;
const startOffsetUp = document.getElementById('start-offset-up') as HTMLButtonElement;
const submit = document.getElementById('submit') as HTMLButtonElement;
const theme = document.getElementById('theme') as HTMLAnchorElement;
const youtube = document.getElementById('youtube') as HTMLDivElement;

// util
const clearClickTimeout = () => {
  if (clickTimeout === null) {
    return;
  }

  clearTimeout(clickTimeout);
  clickTimeout = null;
};
const openLink = (url: string) => window.open(url, '_blank');
const search = async (text?: string) => {
  setInFlight(true, text);
  activeLyricsLink = null;
  activeVideoLink = null;
  message.style.display = 'none';
  image.style.display = '';
  setImageSrc('/loading.gif');
  try {
    const response = await fetch(`/search?q=${query}&p=${page}&eo=${endOffset}&so=${startOffset}`);
    if (response.ok) {
      const { hasMoreEndOffset, hasMorePages, hasMoreStartOffset, imageData, lyricsLink, videoLink } = await response.json();
      setImageSrc(imageData);
      activeLyricsLink = lyricsLink;
      activeVideoLink = videoLink;
      youtube.style.display = videoLink ? '' : 'none';
      next.disabled = !hasMorePages;
      previous.disabled = page === 0;
      endOffsetUp.disabled = !hasMoreEndOffset;
      startOffsetUp.disabled = !hasMoreStartOffset;
      endOffsetDown.disabled = endOffset === 0;
      startOffsetDown.disabled = startOffset === 0;
    } else if (response.status === 404) {
      setMessage('No results :(');
    } else {
      throw 'bad response';
    }
  } catch {
    setMessage('Something went wrong :(');
  } finally {
    setInFlight(false);
  }
};
const setInFlight = (inFlight: boolean, textIfTrue = 'Searching...') => {
  submit.disabled = inFlight || !input.value.trim();
  input.disabled = inFlight;
  submit.textContent = inFlight ? textIfTrue : 'Search';
  image.className = inFlight ? '' : 'loaded';

  if (inFlight) {
    endOffsetDown.disabled = true;
    endOffsetUp.disabled = true;
    startOffsetDown.disabled = true;
    startOffsetUp.disabled = true;
    previous.disabled = true;
    next.disabled = true;
  }
};
const setImageSrc = (src: string) => {
  image.src = src;
  image.style.cursor = src === '/loading.gif' ? '' : 'pointer';
};
const setMessage = (text: string) => {
  image.style.display = 'none';
  message.textContent = text;
  message.style.display = '';
};

// event listeners
theme.addEventListener('click', (event) => {
  event.preventDefault();

  if (!themeClicked) {
    themeClicked = true;
    theme.textContent = themeMessages[0];
    return;
  }

  const themeMessage = themeMessages[themeMessages.indexOf(theme.textContent || '') + 1];
  if (!themeMessage) {
    body.className = 'light';
    theme.style.display = 'none';
    return;
  }
  theme.textContent = themeMessage;
});
input.addEventListener('input', () => {
  submit.disabled = !input.value.trim();
});
previous.addEventListener('click', (event) => {
  endOffset = 0;
  startOffset = 0;
  page--;
  search();
});
next.addEventListener('click', (event) => {
  endOffset = 0;
  startOffset = 0;
  page++;
  search();
});
endOffsetDown.addEventListener('click', (event) => {
  endOffset--;
  search(offsetInFlightText);
});
endOffsetUp.addEventListener('click', (event) => {
  endOffset++;
  search(offsetInFlightText);
});
startOffsetDown.addEventListener('click', (event) => {
  startOffset--;
  search(offsetInFlightText);
});
startOffsetUp.addEventListener('click', (event) => {
  startOffset++;
  search(offsetInFlightText);
});
form.addEventListener('submit', (event) => {
  event.preventDefault();

  endOffset = 0;
  startOffset = 0;
  page = 0;
  query = input.value.trim();
  search();
});
image.addEventListener('click', () => {
  if (!activeLyricsLink) {
    return;
  }
  if (!activeVideoLink) {
    openLink(activeLyricsLink);
    return;
  }

  if (clickTimeout === null) {
    clickTimeout = window.setTimeout(() => {
      clearClickTimeout();
      openLink(activeLyricsLink ?? '');
    }, clickDelay);
  } else {
    clearClickTimeout();
    openLink(activeVideoLink);
  }
});
