// popup.js - Handles the popup UI logic

// --- UI Elements ---
const tabSave = document.getElementById('tab-save');
const tabLibrary = document.getElementById('tab-library');
const viewSave = document.getElementById('view-save');
const viewLibrary = document.getElementById('view-library');

// Save Form Elements
const inputTitle = document.getElementById('page-title');
const inputUrl = document.getElementById('page-url');
const inputNote = document.getElementById('page-note');
const inputTags = document.getElementById('page-tags');
const highlightContainer = document.getElementById('highlight-container');
const highlightText = document.getElementById('page-highlight');
const btnSave = document.getElementById('btn-save');
const btnSaveText = btnSave.querySelector('.btn-text');
const btnSaveIcon = btnSave.querySelector('.success-icon');
const msgStatus = document.getElementById('save-status');

// Library Elements
const searchInput = document.getElementById('search-input');
const libraryList = document.getElementById('library-list');
const emptyState = document.getElementById('empty-state');

// State
let currentPageData = null;
let allMemories = [];

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
  // 1. Setup Tabs
  tabSave.addEventListener('click', () => switchTab('save'));
  tabLibrary.addEventListener('click', () => switchTab('library'));

  // 2. Get current page info
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    
    // Don't run on chrome:// internal pages
    if (activeTab.url.startsWith('chrome://')) {
      showError("Cannot save Chrome internal pages.");
      return;
    }

    // Ask content script for page details
    chrome.tabs.sendMessage(activeTab.id, { action: "GET_PAGE_INFO" }, (response) => {
      if (chrome.runtime.lastError) {
        // Content script might not be injected yet or page is restricted
        console.warn("Could not communicate with page:", chrome.runtime.lastError.message);
        
        // Fallback to basic tab info
        currentPageData = {
          title: activeTab.title || 'Unknown Title',
          url: activeTab.url || '',
          summary: '',
          highlight: '',
          favicon: activeTab.favIconUrl || ''
        };
      } else if (response) {
        currentPageData = response;
      }
      
      populateSaveForm();
    });
  });

  // 3. Bind save button
  btnSave.addEventListener('click', handleSave);

  // 4. Bind search
  searchInput.addEventListener('input', (e) => {
    renderLibrary(e.target.value);
  });
});

// --- Tab Logic ---

function switchTab(tabId) {
  if (tabId === 'save') {
    tabSave.classList.add('active');
    tabLibrary.classList.remove('active');
    viewSave.classList.add('active');
    viewLibrary.classList.remove('active');
  } else {
    tabLibrary.classList.add('active');
    tabSave.classList.remove('active');
    viewLibrary.classList.add('active');
    viewSave.classList.remove('active');
    loadLibrary(); // Refresh data when opening tab
  }
}

// --- Save View Logic ---

function populateSaveForm() {
  if (!currentPageData) return;

  inputTitle.value = currentPageData.title;
  inputUrl.value = currentPageData.url;

  if (currentPageData.highlight) {
    highlightText.textContent = `"${currentPageData.highlight}"`;
    highlightContainer.classList.remove('hidden');
  }
}

function showError(msg) {
  inputTitle.value = "Error";
  inputUrl.value = "";
  msgStatus.textContent = msg;
  btnSave.disabled = true;
  btnSave.style.opacity = "0.5";
  btnSave.style.cursor = "not-allowed";
}

function handleSave() {
  if (!currentPageData) return;
  if (btnSave.disabled) return;

  // Process tags
  const rawTags = inputTags.value;
  const tagsArray = rawTags.split(',')
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length > 0);

  const payload = {
    ...currentPageData,
    note: inputNote.value.trim(),
    tags: tagsArray
  };

  // Show loading state
  btnSaveText.textContent = "Saving...";
  btnSave.disabled = true;

  // Send to background
  chrome.runtime.sendMessage({ action: "SAVE_ENTRY", data: payload }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      msgStatus.textContent = "Failed to save. Try again.";
      btnSaveText.textContent = "Save to Recall";
      btnSave.disabled = false;
      return;
    }

    // Success animation
    btnSave.classList.add('success');
    btnSaveText.textContent = "Saved!";
    btnSaveIcon.classList.remove('hidden');
    msgStatus.textContent = response.updated ? "Updated existing memory." : "";
    
    // Auto switch to library after a brief delay
    setTimeout(() => {
      switchTab('library');
      
      // Reset button
      btnSave.classList.remove('success');
      btnSaveText.textContent = "Save to Recall";
      btnSaveIcon.classList.add('hidden');
      msgStatus.textContent = "";
      btnSave.disabled = false;
    }, 1500);
  });
}

// --- Library View Logic ---

function loadLibrary() {
  chrome.runtime.sendMessage({ action: "GET_ALL" }, (response) => {
    if (response && response.success) {
      allMemories = response.recalls || [];
      renderLibrary();
    }
  });
}

function renderLibrary(searchQuery = "") {
  libraryList.innerHTML = '';
  const query = searchQuery.trim().toLowerCase();
  
  // Filter
  const filtered = allMemories.filter(m => {
    if (!query) return true;
    
    const titleMatch = (m.title || "").toLowerCase().includes(query);
    const urlMatch = (m.url || "").toLowerCase().includes(query);
    const noteMatch = (m.note || "").toLowerCase().includes(query);
    const tagsMatch = (m.tags || []).some(t => t.toLowerCase().includes(query));
    
    return titleMatch || urlMatch || noteMatch || tagsMatch;
  });

  // Emtpy state
  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    if (query && allMemories.length > 0) {
      emptyState.querySelector('span').textContent = "No matches found for search.";
    } else {
      emptyState.querySelector('span').textContent = "Save a page to get started.";
    }
    return;
  }
  
  emptyState.classList.add('hidden');

  // Render cards
  filtered.forEach(memory => {
    const card = document.createElement('div');
    card.className = 'memory-card';
    
    // Tags HTML
    const tagsHtml = (memory.tags || [])
      .map(t => `<span class="tag-badge">${t}</span>`)
      .join('');
      
    // Highlight HTML
    const highlightHtml = memory.highlight 
      ? `<div class="card-highlight">"${memory.highlight}"</div>` 
      : '';

    // Note HTML
    const noteHtml = memory.note
      ? `<div class="card-note">${memory.note}</div>`
      : `<div class="card-note" style="opacity:0.5">${memory.summary || "No description"}</div>`;

    card.innerHTML = `
      <div class="card-header">
        <img src="${memory.favicon || '../icons/icon16.png'}" class="card-favicon" onerror="this.src='../icons/icon16.png'">
        <a href="${memory.url}" target="_blank" class="card-title" title="${memory.title}">${memory.title}</a>
        <button class="delete-btn" data-id="${memory.id}" title="Delete memory">🗑️</button>
      </div>
      ${highlightHtml}
      ${noteHtml}
      <div class="card-footer">
        <div class="card-tags">${tagsHtml}</div>
        <div class="card-date">${memory.savedAt || 'Unknown date'}</div>
      </div>
    `;

    libraryList.appendChild(card);
  });

  // Bind delete buttons
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      deleteMemory(id);
    });
  });
}

function deleteMemory(id) {
  if (!confirm("Delete this memory?")) return;
  
  chrome.runtime.sendMessage({ action: "DELETE_ENTRY", id }, (response) => {
    if (response && response.success) {
      // Remove from local array and re-render
      allMemories = allMemories.filter(m => m.id !== id);
      renderLibrary(searchInput.value);
    } else {
      alert("Failed to delete memory.");
    }
  });
}
