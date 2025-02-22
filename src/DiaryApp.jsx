import React, { useState, useEffect } from "react";
import './DiaryApp.css';

const DiaryApp = () => {
  const [hasKeys, setHasKeys] = useState(false);
  const [entry, setEntry] = useState("");
  const [decryptedContent, setDecryptedContent] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importedKeys, setImportedKeys] = useState({ publicKey: "", privateKey: "" });
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    const publicKey = localStorage.getItem("publicKey");
    const privateKey = localStorage.getItem("privateKey");
    setHasKeys(!!publicKey && !!privateKey);
  }, []);

  const generateKeys = async () => {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
    );
    
    const publicKey = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
    const privateKey = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    
    localStorage.setItem("publicKey", btoa(String.fromCharCode(...new Uint8Array(publicKey))));
    localStorage.setItem("privateKey", btoa(String.fromCharCode(...new Uint8Array(privateKey))));
    
    setHasKeys(true);
  };

  const handleImportKeys = () => {
    if (!importedKeys.publicKey || !importedKeys.privateKey) {
      alert("Please provide both public and private keys");
      return;
    }

    try {
      localStorage.setItem("publicKey", importedKeys.publicKey);
      localStorage.setItem("privateKey", importedKeys.privateKey);
      setHasKeys(true);
      setIsImporting(false);
    } catch (error) {
      alert("Invalid key format. Please check your keys and try again.");
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const keys = JSON.parse(text);
      setImportedKeys(keys);
      localStorage.setItem("publicKey", keys.publicKey);
      localStorage.setItem("privateKey", keys.privateKey);
      setHasKeys(true);
    } catch (error) {
      alert("Invalid key file. Please select a valid key file.");
    }
  };

  const exportKeys = () => {
    const publicKey = localStorage.getItem("publicKey");
    const privateKey = localStorage.getItem("privateKey");
    
    const keysData = JSON.stringify({ publicKey, privateKey }, null, 2);
    const blob = new Blob([keysData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diary-keys.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Warn and ask for key export before logout
  const handleLogout = () => {
    if (window.confirm("Would you like to export your keys before logging out?")) {
      exportKeys();
    }
    localStorage.removeItem("publicKey");
    localStorage.removeItem("privateKey");
    setHasKeys(false);
    setEntry("");
    setDecryptedContent("");
    setSelectedFile(null);
  };

  // Helper: Convert a number to a 2-byte Uint8Array
  const toUint16Bytes = (num) => {
    return new Uint8Array([
      (num >> 8) & 0xff, // high byte
      num & 0xff,        // low byte
    ]);
  };

  // Helper: Read a 2-byte length from dataArray at offset
  const readUint16Bytes = (arr, offset) => {
    const high = arr[offset];
    const low = arr[offset + 1];
    return (high << 8) + low;
  };

  const encryptData = async (data) => {
    // Generate AES key for the actual encryption
    const aesKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    // Generate random IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the data with AES
    const encryptedContent = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      data
    );

    // Export AES key to raw format
    const rawKey = await window.crypto.subtle.exportKey("raw", aesKey);

    // Get RSA public key
    const publicKeyPem = localStorage.getItem("publicKey");
    const publicKey = await window.crypto.subtle.importKey(
      "spki",
      Uint8Array.from(atob(publicKeyPem), c => c.charCodeAt(0)),
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"]
    );

    // Encrypt the AES key with RSA
    const encryptedKey = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      rawKey
    );

    // Prepare length bytes
    const encryptedKeyLenBytes = toUint16Bytes(encryptedKey.byteLength);
    const ivLenBytes = toUint16Bytes(iv.length);

    // Combine everything into a single Blob
    return new Blob([
      encryptedKeyLenBytes,
      new Uint8Array(encryptedKey),
      ivLenBytes,
      iv,
      new Uint8Array(encryptedContent),
    ]);
  };

  const decryptData = async (fileBlob) => {
    const dataArray = new Uint8Array(await fileBlob.arrayBuffer());
    let offset = 0;

    // Read 2-byte key length
    const keyLength = readUint16Bytes(dataArray, offset);
    offset += 2;

    // Extract encrypted RSA key
    const encryptedKey = dataArray.slice(offset, offset + keyLength);
    offset += keyLength;

    // Read 2-byte IV length
    const ivLength = readUint16Bytes(dataArray, offset);
    offset += 2;

    // Extract IV
    const iv = dataArray.slice(offset, offset + ivLength);
    offset += ivLength;

    // The rest is encrypted AES content
    const encryptedContent = dataArray.slice(offset);

    // Get RSA private key
    const privateKeyPem = localStorage.getItem("privateKey");
    const privateKey = await window.crypto.subtle.importKey(
      "pkcs8",
      Uint8Array.from(atob(privateKeyPem), c => c.charCodeAt(0)),
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["decrypt"]
    );

    // Decrypt the AES key
    const decryptedKeyBuffer = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      encryptedKey
    );

    // Import the AES key
    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      decryptedKeyBuffer,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    // Decrypt the content
    return await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      aesKey,
      encryptedContent
    );
  };

  const handleEncryption = async (content, filename) => {
    try {
      const encryptedBlob = await encryptData(content);
      const encryptedFileName = `${filename}.enc`;
      
      const url = URL.createObjectURL(encryptedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = encryptedFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSelectedFile({ name: filename });
    } catch (error) {
      console.error("Encryption error:", error);
      alert("Error encrypting content. Please try again.");
    }
  };

  const handleSaveEntry = async () => {
    if (!entry) return;
    
    const textEncoder = new TextEncoder();
    const contentArray = textEncoder.encode(entry);
    const timestamp = Date.now();
    await handleEncryption(contentArray, `diary-entry-${timestamp}.txt`);
    setEntry("");
  };

  const handleFileEncryption = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const content = await file.arrayBuffer();
    await handleEncryption(content, file.name);
  };

  const handleFileDecryption = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      const decryptedBuffer = await decryptData(file);
      const originalFileName = file.name.replace('.enc', '');

      if (originalFileName.endsWith('.txt')) {
        // Handle text files
        const textDecoder = new TextDecoder();
        const decryptedText = textDecoder.decode(decryptedBuffer);
        setDecryptedContent(decryptedText);
      } else {
        // Handle other files (e.g., images, PDFs, etc.)
        const blob = new Blob([decryptedBuffer]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = originalFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setDecryptedContent("");
      }
    } catch (error) {
      console.error("Decryption error:", error);
      setDecryptedContent("Error decrypting file. Make sure you're using the correct keys.");
    }
  };

  if (!hasKeys) {
    return (
      <div className="diary-container">
        <div className="diary-section">
          <h1 className="diary-title">📝 Secure Diary</h1>
          {!isImporting ? (
            <>
              <div className="welcome-text">
                Get started by generating new keys or importing existing ones
              </div>
              
              <div className="button-stack">
                <button 
                  onClick={generateKeys}
                  className="button button-primary"
                >
                  Generate New Keys
                </button>

                <div className="or-divider">OR</div>

                <div className="import-buttons-wrapper">
                  <label className="button button-secondary">
                    Import Keys from File
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                  </label>
                  
                  <button 
                    onClick={() => setIsImporting(true)}
                    className="button button-secondary"
                  >
                    Import Keys Manually
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="import-section">
              <div className="input-group">
                <label>Public Key</label>
                <textarea
                  value={importedKeys.publicKey}
                  onChange={(e) => setImportedKeys(prev => ({ ...prev, publicKey: e.target.value }))}
                  placeholder="Paste your public key here..."
                  className="import-textarea"
                />
              </div>
              <div className="input-group">
                <label>Private Key</label>
                <textarea
                  value={importedKeys.privateKey}
                  onChange={(e) => setImportedKeys(prev => ({ ...prev, privateKey: e.target.value }))}
                  placeholder="Paste your private key here..."
                  className="import-textarea"
                />
              </div>
              <div className="button-group">
                <button
                  onClick={handleImportKeys}
                  className="button button-primary"
                >
                  Import Keys
                </button>
                <button
                  onClick={() => setIsImporting(false)}
                  className="button button-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="diary-container">
      <div className="diary-header">
        <h1 className="diary-title">📝 Secure Diary</h1>
        <div className="diary-buttons">
          <button 
            onClick={exportKeys}
            className="button button-primary"
          >
            Export Keys
          </button>
          <button 
            onClick={handleLogout}
            className="button button-secondary"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="diary-section">
        <h2 className="section-title">Text Entry</h2>
        <textarea
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          placeholder="Dear Diary..."
          className="diary-textarea"
        />
        <div className="entry-footer">
          <button
            onClick={handleSaveEntry}
            className="button button-primary"
          >
            Save Entry
          </button>
          {selectedFile && (
            <span className="file-name">
              Saved as: {selectedFile.name}
            </span>
          )}
        </div>
      </div>

      <div className="diary-section">
        <h2 className="section-title">Encrypt File</h2>
        <div className="file-upload-container">
          <label className="button button-primary file-button">
            Choose File to Encrypt
            <input
              type="file"
              onChange={handleFileEncryption}
              style={{ display: 'none' }}
            />
          </label>
          {selectedFile && (
            <span className="file-name">
              Selected: {selectedFile.name}
            </span>
          )}
        </div>
      </div>

      <div className="diary-section">
        <h2 className="section-title">Decrypt File</h2>
        <div className="file-upload-container">
          <label className="button button-primary file-button">
            Choose File to Decrypt
            <input
              type="file"
              accept=".enc"
              onChange={handleFileDecryption}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {decryptedContent && (
        <div className="diary-section">
          <h2 className="section-title">Decrypted Text</h2>
          <div className="decrypted-content">
            {decryptedContent}
          </div>
        </div>
      )}
    </div>
  );
};

export default DiaryApp;
