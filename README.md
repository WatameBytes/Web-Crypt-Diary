# Secure Diary App

A React-based secure diary application that provides end-to-end encryption for text entries and files using RSA and AES encryption.

## Features

- **Secure Key Management**
  - Generate new RSA key pairs
  - Import existing keys manually or from a file
  - Export keys for backup and cross-device usage
  - Local storage of encryption keys

- **Text Entry Encryption**
  - Write and encrypt diary entries
  - Automatic timestamp-based file naming
  - Export encrypted entries as files

- **File Encryption**
  - Encrypt any type of file
  - Decrypt previously encrypted files
  - Support for viewing decrypted text files in-app
  - Automatic download of decrypted non-text files

## Security Implementation

The app implements a hybrid encryption system:

1. **RSA Encryption (RSA-OAEP)**
   - 2048-bit key length
   - SHA-256 hashing
   - Used for encrypting the AES key

2. **AES Encryption (AES-GCM)**
   - 256-bit key length
   - Random IV generation for each encryption
   - Used for encrypting the actual content

## Getting Started

### Prerequisites

- Modern web browser with Web Crypto API support
- React development environment

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```

### First-Time Usage

1. Generate new encryption keys or import existing ones
2. Begin creating encrypted diary entries or encrypting files
3. Export your keys for safekeeping

## Usage

### Managing Keys

- **Generate New Keys**: Click "Generate New Keys" on the welcome screen
- **Import Keys**: Either upload a key file or paste keys manually
- **Export Keys**: Click "Export Keys" in the header to save your keys
- **Logout**: Removes keys from local storage (prompts for key export)

### Creating Diary Entries

1. Write your entry in the text area
2. Click "Save Entry" to encrypt and download the entry
3. Files are saved with timestamp-based names (e.g., `diary-entry-1234567890.txt.enc`)

### File Operations

- **Encrypting Files**:
  1. Click "Choose File to Encrypt"
  2. Select any file from your device
  3. Receive the encrypted version with `.enc` extension

- **Decrypting Files**:
  1. Click "Choose File to Decrypt"
  2. Select a previously encrypted `.enc` file
  3. Text files will display in-app
  4. Other file types will automatically download

## Security Considerations

- Keys are stored in browser's localStorage
- Always export and safely store your keys
- Clear keys when using on shared devices
- No cloud storage - all files are saved locally
- No recovery mechanism for lost keys

## Technical Notes

- Uses Web Crypto API for cryptographic operations
- Implements hybrid RSA/AES encryption for efficiency
- Binary data handling using Uint8Array and Blob
- File handling through browser's File API

## File Format

Encrypted files follow this binary format:
1. Encrypted key length (2 bytes)
2. RSA-encrypted AES key
3. IV length (2 bytes)
4. AES-GCM IV
5. AES-encrypted content

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source. Please add appropriate license information here.