// content.js - Injected into pages to extract information

/**
 * Extracts a decent summary from the page text.
 * Finds paragraphs, strips weird spacing, takes first ~300 chars.
 */
function getPageSummary() {
  const paragraphs = Array.from(document.querySelectorAll('p'))
    .map(p => p.innerText.trim())
    .filter(text => text.length > 50); // Ignore tiny snippets
    
  if (paragraphs.length > 0) {
    const combined = paragraphs.join(' ');
    if (combined.length > 300) {
      return combined.substring(0, 300) + '...';
    }
    return combined;
  }
  
  // Fallback if no <p> tags with enough content
  const bodyText = document.body.innerText.trim();
  if (bodyText.length > 300) {
    return bodyText.substring(0, 300) + '...';
  }
  return bodyText || "No content summary available.";
}

/**
 * Gets currently highlighted/selected text on the page
 */
function getSelectedText() {
  const selection = window.getSelection();
  return selection ? selection.toString().trim() : "";
}

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_PAGE_INFO") {
    
    // Attempt to find a high quality icon
    let faviconUrl = "";
    const iconLink = document.querySelector('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
    if (iconLink && iconLink.href) {
      faviconUrl = iconLink.href;
    } else {
      // Fallback to Google's favicon service
      const domain = new URL(window.location.href).hostname;
      faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    }

    sendResponse({
      title: document.title,
      url: window.location.href,
      summary: getPageSummary(),
      highlight: getSelectedText(),
      favicon: faviconUrl
    });
  }
  // Important: Keeps the message channel open for async response
  return true;
});
