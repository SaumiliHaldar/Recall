// background.js - Service worker for background tasks and storage

/**
 * Generate a simple unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Get current time in specified format
 */
function getCurrentTimestamp() {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
}

/**
 * Save a new entry to storage
 */
async function saveEntry(entryData) {
  try {
    const data = await chrome.storage.local.get({ recalls: [] });
    const recalls = data.recalls;
    
    // Format the new entry
    const newEntry = {
      id: generateId(),
      title: entryData.title || "Untitled",
      url: entryData.url,
      summary: entryData.summary || "",
      highlight: entryData.highlight || "",
      tags: entryData.tags || [],
      note: entryData.note || "",
      savedAt: getCurrentTimestamp(),
      favicon: entryData.favicon || ""
    };

    // Check if URL already exists
    const existingIndex = recalls.findIndex(r => r.url === newEntry.url);
    if (existingIndex >= 0) {
      // Update existing
      newEntry.id = recalls[existingIndex].id; // Keep original ID
      newEntry.savedAt = getCurrentTimestamp(); // Update timestamp
      recalls[existingIndex] = newEntry;
      await chrome.storage.local.set({ recalls });
      return { success: true, updated: true, entry: newEntry };
    } else {
      // Add new
      recalls.unshift(newEntry); // Add to beginning (newest first)
      await chrome.storage.local.set({ recalls });
      return { success: true, updated: false, entry: newEntry };
    }
  } catch (error) {
    console.error("Error saving entry:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete an entry by ID
 */
async function deleteEntry(id) {
  try {
    const data = await chrome.storage.local.get({ recalls: [] });
    const updatedRecalls = data.recalls.filter(r => r.id !== id);
    await chrome.storage.local.set({ recalls: updatedRecalls });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Global message router
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SAVE_ENTRY") {
    saveEntry(request.data).then(sendResponse);
    return true; // Keep channel open
  }
  
  if (request.action === "DELETE_ENTRY") {
    deleteEntry(request.id).then(sendResponse);
    return true;
  }
  
  if (request.action === "GET_ALL") {
    chrome.storage.local.get({ recalls: [] }).then(data => {
      sendResponse({ success: true, recalls: data.recalls });
    });
    return true;
  }
});

// Create context menu for quick saving (right click on page)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-to-recall",
    title: "Save page to Recall",
    contexts: ["page", "selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-to-recall") {
    // Inject content script to get page info and save it
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    }, () => {
      // After injection, request data
      chrome.tabs.sendMessage(tab.id, { action: "GET_PAGE_INFO" }, (response) => {
        if (chrome.runtime.lastError || !response) {
          console.error("Could not get page info for context menu save.");
          return;
        }
        
        // Save the entry
        // If there's selected text from context menu, use it
        if (info.selectionText) {
          response.highlight = info.selectionText;
        }
        
        saveEntry({
          ...response,
          note: "Saved via right-click menu.",
          tags: ["quick-save"]
        });
      });
    });
  }
});
