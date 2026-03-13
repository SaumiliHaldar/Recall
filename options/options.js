// options.js - Settings page logic

document.addEventListener('DOMContentLoaded', () => {
  const btnExport = document.getElementById('btn-export');
  const btnImport = document.getElementById('btn-import');
  const inputImport = document.getElementById('file-import');
  const btnClear = document.getElementById('btn-clear');
  const msgStatus = document.getElementById('status-msg');
  const versionText = document.getElementById('version-text');

  // Load version from manifest
  const manifest = chrome.runtime.getManifest();
  if (manifest && manifest.version) {
    versionText.textContent = manifest.version;
  }

  function showStatus(msg, isError = false) {
    msgStatus.textContent = msg;
    msgStatus.className = 'status-msg ' + (isError ? 'error' : 'success');
    msgStatus.style.display = 'block';
    setTimeout(() => {
      msgStatus.style.display = 'none';
    }, 3000);
  }

  // --- Export Data ---
  btnExport.addEventListener('click', () => {
    chrome.storage.local.get({ recalls: [] }, (data) => {
      if (data.recalls.length === 0) {
        showStatus("Nothing to export. Your memory is empty.", true);
        return;
      }

      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      // Use current date for filename
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `recall-backup-${dateStr}.json`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showStatus("Export successful!");
    });
  });

  // --- Import Data ---
  btnImport.addEventListener('click', () => {
    inputImport.click();
  });

  inputImport.addEventListener('change', (e) => {
    if (e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        
        // Basic validation
        if (!jsonData || !Array.isArray(jsonData.recalls)) {
          throw new Error("Invalid file format. Missing 'recalls' array.");
        }

        // Save imported data
        chrome.storage.local.set({ recalls: jsonData.recalls }, () => {
          showStatus(`Imported ${jsonData.recalls.length} memories successfully!`);
          // Reset input so the same file could be imported again if needed
          inputImport.value = '';
        });
        
      } catch (error) {
        console.error("Import error:", error);
        showStatus("Failed to parse JSON file.", true);
        inputImport.value = '';
      }
    };
    
    reader.readAsText(file);
  });

  // --- Clear Data ---
  btnClear.addEventListener('click', () => {
    const confirmClear = confirm("Are you absolutely sure? This will delete all saved pages permanently and cannot be undone.");
    
    if (confirmClear) {
      chrome.storage.local.set({ recalls: [] }, () => {
        showStatus("All data cleared successfully.");
      });
    }
  });
});
